
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS tier_silver_amount numeric,
  ADD COLUMN IF NOT EXISTS tier_gold_amount numeric,
  ADD COLUMN IF NOT EXISTS included_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS excluded_items text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.project_equipment
  ADD COLUMN IF NOT EXISTS cost_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'other';

ALTER TABLE public.crew_assignments
  ADD COLUMN IF NOT EXISTS cost_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'crew';

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS internal_cost_per_day numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS highlight text;

CREATE TABLE IF NOT EXISTS public.project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  event_type text,
  default_included text[] NOT NULL DEFAULT ARRAY[]::text[],
  default_excluded text[] NOT NULL DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('equipment','crew')),
  equipment_id uuid,
  crew_role text,
  quantity integer NOT NULL DEFAULT 1,
  section text NOT NULL DEFAULT 'other',
  daily_rate numeric NOT NULL DEFAULT 0,
  cost_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_project_templates
  BEFORE UPDATE ON public.project_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
CREATE POLICY "view org templates" ON public.project_templates
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT user_organization_ids()) AND user_has_permission('projects.view'));

CREATE POLICY "manage org templates" ON public.project_templates
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT user_organization_ids()) AND user_has_permission('projects.manage'))
  WITH CHECK (organization_id IN (SELECT user_organization_ids()) AND user_has_permission('projects.manage'));

CREATE POLICY "view template items" ON public.project_template_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_templates t
    WHERE t.id = project_template_items.template_id
      AND t.organization_id IN (SELECT user_organization_ids())
      AND user_has_permission('projects.view')));

CREATE POLICY "manage template items" ON public.project_template_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_templates t
    WHERE t.id = project_template_items.template_id
      AND t.organization_id IN (SELECT user_organization_ids())
      AND user_has_permission('projects.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_templates t
    WHERE t.id = project_template_items.template_id
      AND t.organization_id IN (SELECT user_organization_ids())
      AND user_has_permission('projects.manage')));
