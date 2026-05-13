
-- Equipment: extra columns for photos, manual, condition
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS manual_url text,
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS purchase_price numeric;

-- Maintenance logs
CREATE TABLE IF NOT EXISTS public.equipment_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'service',
  performed_at date NOT NULL DEFAULT CURRENT_DATE,
  next_due date,
  cost numeric NOT NULL DEFAULT 0,
  description text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view org maintenance" ON public.equipment_maintenance
FOR SELECT TO authenticated
USING (organization_id IN (SELECT user_organization_ids()) AND user_has_permission('equipment.view'));

CREATE POLICY "manage org maintenance" ON public.equipment_maintenance
FOR ALL TO authenticated
USING (organization_id IN (SELECT user_organization_ids()) AND user_has_permission('equipment.manage'))
WITH CHECK (organization_id IN (SELECT user_organization_ids()) AND user_has_permission('equipment.manage'));

-- Kits
CREATE TABLE IF NOT EXISTS public.equipment_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid,
  name text NOT NULL,
  description text,
  daily_rate numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view org kits" ON public.equipment_kits
FOR SELECT TO authenticated
USING (organization_id IN (SELECT user_organization_ids()) AND user_has_permission('equipment.view'));

CREATE POLICY "manage org kits" ON public.equipment_kits
FOR ALL TO authenticated
USING (organization_id IN (SELECT user_organization_ids()) AND user_has_permission('equipment.manage'))
WITH CHECK (organization_id IN (SELECT user_organization_ids()) AND user_has_permission('equipment.manage'));

CREATE TRIGGER trg_kits_updated BEFORE UPDATE ON public.equipment_kits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.equipment_kits(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view kit_items" ON public.kit_items
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.equipment_kits k WHERE k.id = kit_items.kit_id
  AND k.organization_id IN (SELECT user_organization_ids())
  AND user_has_permission('equipment.view')));

CREATE POLICY "manage kit_items" ON public.kit_items
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.equipment_kits k WHERE k.id = kit_items.kit_id
  AND k.organization_id IN (SELECT user_organization_ids())
  AND user_has_permission('equipment.manage')))
WITH CHECK (EXISTS (SELECT 1 FROM public.equipment_kits k WHERE k.id = kit_items.kit_id
  AND k.organization_id IN (SELECT user_organization_ids())
  AND user_has_permission('equipment.manage')));

-- Storage bucket for equipment photos and manuals
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment', 'equipment', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read equipment files" ON storage.objects
FOR SELECT USING (bucket_id = 'equipment');

CREATE POLICY "auth upload equipment files" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'equipment');

CREATE POLICY "auth update equipment files" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'equipment');

CREATE POLICY "auth delete equipment files" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'equipment');
