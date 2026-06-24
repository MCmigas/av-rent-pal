
CREATE OR REPLACE FUNCTION public.convert_project_to_invoice(_project_id uuid, _due_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Org scope check before permission gate (don't leak cross-org project existence)
  IF NOT public.is_super_admin()
     AND _project.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF NOT public.user_has_permission('invoices.manage') AND NOT public.is_super_admin() THEN
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

  _days := GREATEST(1, COALESCE(
    (date_part('day', _project.end_date - _project.start_date)::int) + 1, 1));

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

  UPDATE public.invoices
     SET subtotal = _subtotal,
         vat_amount = round(_subtotal * 0.23, 2),
         amount = round(_subtotal * 1.23, 2)
   WHERE id = _invoice_id;

  IF _project.status = 'quote' THEN
    UPDATE public.projects SET status = 'confirmed' WHERE id = _project_id;
  END IF;

  RETURN _invoice_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_booked_quantity(_equipment_id uuid, _from timestamp with time zone, _to timestamp with time zone, _exclude_pe_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result int;
BEGIN
  IF NOT public.is_super_admin() AND NOT EXISTS (
    SELECT 1 FROM public.equipment e
    WHERE e.id = _equipment_id
      AND e.organization_id IN (SELECT public.user_organization_ids())
  ) THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(pe.quantity), 0)::int INTO _result
  FROM public.project_equipment pe
  JOIN public.projects p ON p.id = pe.project_id
  WHERE pe.equipment_id = _equipment_id
    AND (_exclude_pe_id IS NULL OR pe.id <> _exclude_pe_id)
    AND p.status IN ('confirmed', 'in_progress')
    AND COALESCE(pe.pickup_date, p.start_date) < _to
    AND COALESCE(pe.return_date, p.end_date)   > _from;

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_availability(_equipment_id uuid, _from timestamp with time zone, _to timestamp with time zone, _exclude_pe_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _stock int;
BEGIN
  IF NOT public.is_super_admin() AND NOT EXISTS (
    SELECT 1 FROM public.equipment e
    WHERE e.id = _equipment_id
      AND e.organization_id IN (SELECT public.user_organization_ids())
  ) THEN
    RETURN 0;
  END IF;

  SELECT quantity INTO _stock FROM public.equipment WHERE id = _equipment_id;
  RETURN GREATEST(COALESCE(_stock, 0) - public.equipment_booked_quantity(_equipment_id, _from, _to, _exclude_pe_id), 0)::int;
END;
$function$;
