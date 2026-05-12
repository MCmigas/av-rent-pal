-- ============ invoice_items ============
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 23,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view invoice_items" ON public.invoice_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices i
  WHERE i.id = invoice_items.invoice_id
    AND (
      is_super_admin()
      OR (i.organization_id IN (SELECT user_organization_ids())
          AND (user_has_permission('invoices.view') OR i.client_id = auth.uid()))
    )
));

CREATE POLICY "manage invoice_items" ON public.invoice_items
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.invoices i
  WHERE i.id = invoice_items.invoice_id
    AND i.organization_id IN (SELECT user_organization_ids())
    AND user_has_permission('invoices.manage')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.invoices i
  WHERE i.id = invoice_items.invoice_id
    AND i.organization_id IN (SELECT user_organization_ids())
    AND user_has_permission('invoices.manage')
));

-- ============ invoices: extra columns ============
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 23,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS quote_project_id uuid REFERENCES public.projects(id);

-- ============ invoice_sequences ============
CREATE TABLE public.invoice_sequences (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  prefix text NOT NULL DEFAULT 'FAT',
  PRIMARY KEY (organization_id, year)
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view sequences" ON public.invoice_sequences
FOR SELECT TO authenticated
USING (is_super_admin() OR (organization_id IN (SELECT user_organization_ids()) AND is_admin()));

-- ============ next_invoice_number(org) ============
CREATE OR REPLACE FUNCTION public.next_invoice_number(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year int := extract(year FROM now())::int;
  _n int;
  _prefix text;
BEGIN
  IF NOT (is_super_admin() OR (_org_id IN (SELECT user_organization_ids()) AND user_has_permission('invoices.manage'))) THEN
    RAISE EXCEPTION 'Sem permissão para gerar número de fatura';
  END IF;

  INSERT INTO public.invoice_sequences (organization_id, year, last_number)
  VALUES (_org_id, _year, 1)
  ON CONFLICT (organization_id, year) DO UPDATE
    SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number, prefix INTO _n, _prefix;

  RETURN _prefix || ' ' || _year || '/' || lpad(_n::text, 4, '0');
END;
$$;

-- ============ convert_project_to_invoice ============
CREATE OR REPLACE FUNCTION public.convert_project_to_invoice(_project_id uuid, _due_date date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project public.projects;
  _invoice_id uuid;
  _invoice_no text;
  _subtotal numeric := 0;
  _days int;
  _line_total numeric;
  _r RECORD;
BEGIN
  SELECT * INTO _project FROM public.projects WHERE id = _project_id;
  IF _project.id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF NOT user_has_permission('invoices.manage') AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão para faturar';
  END IF;

  _invoice_no := public.next_invoice_number(_project.organization_id);

  INSERT INTO public.invoices (
    organization_id, location_id, project_id, quote_project_id, client_id,
    invoice_number, status, issue_date, due_date,
    subtotal, vat_rate, vat_amount, amount, currency, notes
  ) VALUES (
    _project.organization_id, _project.location_id, _project_id, _project_id, _project.client_id,
    _invoice_no, 'draft', CURRENT_DATE, COALESCE(_due_date, CURRENT_DATE + 30),
    0, 23, 0, 0, 'EUR',
    'Fatura referente ao projeto: ' || _project.title
  ) RETURNING id INTO _invoice_id;

  -- Days between start/end (default 1)
  _days := GREATEST(1, COALESCE(
    (date_part('day', _project.end_date - _project.start_date)::int) + 1, 1));

  -- Equipment lines
  FOR _r IN
    SELECT pe.quantity, pe.rate, pe.pickup_date, pe.return_date, e.name
    FROM public.project_equipment pe
    JOIN public.equipment e ON e.id = pe.equipment_id
    WHERE pe.project_id = _project_id
  LOOP
    DECLARE _d int := GREATEST(1, COALESCE(
      (date_part('day', _r.return_date - _r.pickup_date)::int) + 1, _days));
    BEGIN
      _line_total := _r.rate * _d;
      INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price)
      VALUES (_invoice_id,
              _r.name || ' (' || _d || ' dia' || CASE WHEN _d>1 THEN 's' ELSE '' END || ')',
              _r.quantity, _line_total);
      _subtotal := _subtotal + (_r.quantity * _line_total);
    END;
  END LOOP;

  -- Crew lines
  FOR _r IN
    SELECT ca.daily_rate, ca.role, ca.start_date, ca.end_date, p.full_name
    FROM public.crew_assignments ca
    LEFT JOIN public.profiles p ON p.id = ca.user_id
    WHERE ca.project_id = _project_id
  LOOP
    DECLARE _d int := GREATEST(1, COALESCE(
      (date_part('day', _r.end_date - _r.start_date)::int) + 1, _days));
    BEGIN
      INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price)
      VALUES (_invoice_id,
              'Crew — ' || COALESCE(_r.full_name, _r.role) || ' (' || _r.role || ', ' || _d || 'd)',
              1, _r.daily_rate * _d);
      _subtotal := _subtotal + (_r.daily_rate * _d);
    END;
  END LOOP;

  -- Update totals
  UPDATE public.invoices
     SET subtotal = _subtotal,
         vat_amount = round(_subtotal * 0.23, 2),
         amount = round(_subtotal * 1.23, 2)
   WHERE id = _invoice_id;

  -- Mark project as confirmed if it was a quote
  IF _project.status = 'quote' THEN
    UPDATE public.projects SET status = 'confirmed' WHERE id = _project_id;
  END IF;

  RETURN _invoice_id;
END;
$$;