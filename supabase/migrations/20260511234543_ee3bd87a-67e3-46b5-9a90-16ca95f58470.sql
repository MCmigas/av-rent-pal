
-- Per-line booking dates
ALTER TABLE public.project_equipment
  ADD COLUMN IF NOT EXISTS pickup_date timestamptz,
  ADD COLUMN IF NOT EXISTS return_date timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS project_equipment_equip_dates_idx
  ON public.project_equipment (equipment_id, pickup_date, return_date);

-- Quantity already booked for an equipment in a [from, to] window.
-- A booking belongs to a project; falls back to project.start_date/end_date
-- when the line has no explicit pickup/return.
-- Only counts projects in 'confirmed' or 'in_progress' (quotes don't block).
CREATE OR REPLACE FUNCTION public.equipment_booked_quantity(
  _equipment_id uuid,
  _from timestamptz,
  _to   timestamptz,
  _exclude_pe_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(pe.quantity), 0)::int
  FROM public.project_equipment pe
  JOIN public.projects p ON p.id = pe.project_id
  WHERE pe.equipment_id = _equipment_id
    AND (_exclude_pe_id IS NULL OR pe.id <> _exclude_pe_id)
    AND p.status IN ('confirmed', 'in_progress')
    AND COALESCE(pe.pickup_date, p.start_date) < _to
    AND COALESCE(pe.return_date, p.end_date)   > _from;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_booked_quantity(uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- Available quantity = stock - booked
CREATE OR REPLACE FUNCTION public.equipment_availability(
  _equipment_id uuid,
  _from timestamptz,
  _to   timestamptz,
  _exclude_pe_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    (SELECT quantity FROM public.equipment WHERE id = _equipment_id) -
    public.equipment_booked_quantity(_equipment_id, _from, _to, _exclude_pe_id),
    0
  )::int;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_availability(uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- Trigger: prevent double-booking on insert/update
CREATE OR REPLACE FUNCTION public.check_equipment_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project public.projects;
  _from timestamptz;
  _to timestamptz;
  _stock int;
  _booked int;
  _equip_name text;
BEGIN
  SELECT * INTO _project FROM public.projects WHERE id = NEW.project_id;
  IF _project.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Quotes/completed/cancelled don't block availability
  IF _project.status NOT IN ('confirmed', 'in_progress') THEN
    RETURN NEW;
  END IF;

  _from := COALESCE(NEW.pickup_date, _project.start_date);
  _to   := COALESCE(NEW.return_date, _project.end_date);

  -- Without dates we can't validate; allow.
  IF _from IS NULL OR _to IS NULL OR _to <= _from THEN
    RETURN NEW;
  END IF;

  SELECT quantity, name INTO _stock, _equip_name
    FROM public.equipment WHERE id = NEW.equipment_id;

  _booked := public.equipment_booked_quantity(NEW.equipment_id, _from, _to, NEW.id);

  IF (_booked + NEW.quantity) > _stock THEN
    RAISE EXCEPTION 'Sem stock suficiente de "%" entre % e %: pedidas %, disponíveis %',
      _equip_name,
      to_char(_from AT TIME ZONE 'Europe/Lisbon', 'DD/MM/YYYY'),
      to_char(_to   AT TIME ZONE 'Europe/Lisbon', 'DD/MM/YYYY'),
      NEW.quantity,
      GREATEST(_stock - _booked, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_equipment_availability_trg ON public.project_equipment;
CREATE TRIGGER check_equipment_availability_trg
  BEFORE INSERT OR UPDATE ON public.project_equipment
  FOR EACH ROW EXECUTE FUNCTION public.check_equipment_availability();

-- When a project becomes 'confirmed', re-validate all its lines.
CREATE OR REPLACE FUNCTION public.check_project_status_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  _from timestamptz;
  _to timestamptz;
  _stock int;
  _booked int;
  _name text;
BEGIN
  IF NEW.status NOT IN ('confirmed', 'in_progress') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT pe.id, pe.equipment_id, pe.quantity, pe.pickup_date, pe.return_date
    FROM public.project_equipment pe
    WHERE pe.project_id = NEW.id
  LOOP
    _from := COALESCE(r.pickup_date, NEW.start_date);
    _to   := COALESCE(r.return_date, NEW.end_date);
    IF _from IS NULL OR _to IS NULL OR _to <= _from THEN CONTINUE; END IF;

    SELECT quantity, name INTO _stock, _name FROM public.equipment WHERE id = r.equipment_id;
    _booked := public.equipment_booked_quantity(r.equipment_id, _from, _to, r.id);
    IF (_booked + r.quantity) > _stock THEN
      RAISE EXCEPTION 'Não é possível confirmar: "%" sobre-reservado entre % e %',
        _name,
        to_char(_from AT TIME ZONE 'Europe/Lisbon', 'DD/MM/YYYY'),
        to_char(_to   AT TIME ZONE 'Europe/Lisbon', 'DD/MM/YYYY')
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_project_status_availability_trg ON public.projects;
CREATE TRIGGER check_project_status_availability_trg
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.check_project_status_availability();
