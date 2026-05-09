
-- ============================================================================
-- FASE 1: Fundação multi-tenant + RBAC
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Organizations
-- ----------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tax_id TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Locations (armazéns)
-- ----------------------------------------------------------------------------
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  iban TEXT,
  bank_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_locations_org ON public.locations(organization_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. User <-> Locations
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, location_id)
);
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_locations_user ON public.user_locations(user_id);
CREATE INDEX idx_user_locations_org ON public.user_locations(organization_id);

-- ----------------------------------------------------------------------------
-- 4. Permission profiles
-- ----------------------------------------------------------------------------
CREATE TABLE public.permission_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_permission_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.permission_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);
ALTER TABLE public.user_permission_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_upp_user ON public.user_permission_profiles(user_id);

-- ----------------------------------------------------------------------------
-- 5. Super admins
-- ----------------------------------------------------------------------------
CREATE TABLE public.super_admins (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. Sensitive actions (auditoria)
-- ----------------------------------------------------------------------------
CREATE TABLE public.sensitive_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  target_user_id UUID,
  target_resource_id UUID,
  target_resource_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sensitive_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sensitive_org_created ON public.sensitive_actions(organization_id, created_at DESC);
CREATE INDEX idx_sensitive_user ON public.sensitive_actions(user_id);

-- ----------------------------------------------------------------------------
-- 7. Auth sessions (online time)
-- ----------------------------------------------------------------------------
CREATE TABLE public.auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address TEXT
);
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_auth_sessions_user ON public.auth_sessions(user_id, started_at DESC);

-- ----------------------------------------------------------------------------
-- 8. Helper functions (SECURITY DEFINER)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.user_organization_ids(_user_id UUID DEFAULT auth.uid())
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT organization_id FROM public.user_locations WHERE user_id = _user_id
  UNION
  SELECT DISTINCT organization_id FROM public.user_permission_profiles WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.user_location_ids(_user_id UUID DEFAULT auth.uid())
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT location_id FROM public.user_locations WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(_permission TEXT, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_permission_profiles upp
      JOIN public.permission_profiles pp ON pp.id = upp.profile_id
      WHERE upp.user_id = _user_id
        AND (_permission = ANY(pp.permissions) OR '*' = ANY(pp.permissions))
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_permission_profiles upp
      JOIN public.permission_profiles pp ON pp.id = upp.profile_id
      WHERE upp.user_id = _user_id
        AND pp.is_system = true
        AND pp.name = 'Administrador'
    );
$$;

-- Replace old has_role / is_staff to delegate to new system (keep signature for back-compat)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin(_user_id) OR public.user_has_permission('projects.view', _user_id);
$$;

CREATE OR REPLACE FUNCTION public.log_sensitive_action(
  _action_type TEXT,
  _category TEXT,
  _description TEXT,
  _location_id UUID DEFAULT NULL,
  _target_user_id UUID DEFAULT NULL,
  _target_resource_id UUID DEFAULT NULL,
  _target_resource_type TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id UUID;
  _org UUID;
BEGIN
  SELECT organization_id INTO _org FROM public.locations WHERE id = _location_id;
  IF _org IS NULL THEN
    SELECT (SELECT organization_id FROM public.user_permission_profiles WHERE user_id = auth.uid() LIMIT 1) INTO _org;
  END IF;
  INSERT INTO public.sensitive_actions
    (user_id, organization_id, location_id, action_type, category, description,
     target_user_id, target_resource_id, target_resource_type, metadata)
  VALUES
    (auth.uid(), _org, _location_id, _action_type, _category, _description,
     _target_user_id, _target_resource_id, _target_resource_type, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_data()
RETURNS void
LANGUAGE SQL SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.sensitive_actions WHERE created_at < now() - interval '90 days';
  DELETE FROM public.auth_sessions WHERE COALESCE(ended_at, last_seen_at) < now() - interval '90 days';
$$;

-- ----------------------------------------------------------------------------
-- 9. Trigger: prevent self permission change
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_self_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.user_id = auth.uid()
     AND NOT public.is_super_admin(auth.uid())
     AND (TG_OP = 'INSERT' OR OLD.profile_id IS DISTINCT FROM NEW.profile_id)
  THEN
    RAISE EXCEPTION 'Não pode alterar o próprio perfil de permissões';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_prevent_self_perm_change
BEFORE INSERT OR UPDATE ON public.user_permission_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_permission_change();

-- ----------------------------------------------------------------------------
-- 10. updated_at triggers
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pp_updated BEFORE UPDATE ON public.permission_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_upp_updated BEFORE UPDATE ON public.user_permission_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 11. Add organization_id + location_id to existing tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;

ALTER TABLE public.equipment ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.equipment ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.projects ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.invoices ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 12. Seed: Eurosom org + Lisboa location + profiles + assign existing user
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  _org_id UUID;
  _loc_id UUID;
  _admin_profile UUID;
  _gestor_profile UUID;
  _op_profile UUID;
  _client_profile UUID;
  _existing_user UUID;
BEGIN
  INSERT INTO public.organizations (name, slug, settings)
  VALUES ('Eurosom', 'eurosom', '{"locale":"pt-PT","timezone":"Europe/Lisbon","currency":"EUR","vat_rate":23}'::jsonb)
  RETURNING id INTO _org_id;

  INSERT INTO public.locations (organization_id, name, slug)
  VALUES (_org_id, 'Lisboa', 'lisboa')
  RETURNING id INTO _loc_id;

  -- Administrador (system, all permissions via '*')
  INSERT INTO public.permission_profiles (organization_id, name, description, permissions, is_system)
  VALUES (_org_id, 'Administrador', 'Acesso total à organização', ARRAY['*'], true)
  RETURNING id INTO _admin_profile;

  INSERT INTO public.permission_profiles (organization_id, name, description, permissions, is_system)
  VALUES (_org_id, 'Gestor', 'Gere operações, equipamento, projetos e faturação', ARRAY[
    'equipment.view','equipment.manage','equipment.maintenance',
    'projects.view','projects.manage','projects.quote','projects.confirm',
    'crew.view','crew.assign','crew.view_hours','crew.view_team_hours','crew.manage_swaps',
    'clients.view','clients.manage',
    'invoices.view','invoices.manage','invoices.send',
    'payments.view','payments.manage',
    'cash.view','cash.close',
    'inbox.view','inbox.manage',
    'maintenance.view','maintenance.manage','maintenance.checklist',
    'reports.view','reports.financial','reports.operational',
    'hr.view','hr.view_hours','hr.view_team_hours',
    'announcements.view','announcements.manage',
    'tickets.view','tickets.manage',
    'dashboard.customize','exports.create'
  ], false)
  RETURNING id INTO _gestor_profile;

  INSERT INTO public.permission_profiles (organization_id, name, description, permissions, is_system)
  VALUES (_org_id, 'Operacional', 'Equipa de armazém e técnicos no terreno', ARRAY[
    'equipment.view',
    'projects.view',
    'crew.view','crew.view_hours','crew.manage_swaps',
    'maintenance.view','maintenance.checklist',
    'announcements.view',
    'tickets.view','tickets.manage',
    'dashboard.customize'
  ], false)
  RETURNING id INTO _op_profile;

  INSERT INTO public.permission_profiles (organization_id, name, description, permissions, is_system)
  VALUES (_org_id, 'Cliente', 'Acesso ao portal do cliente', ARRAY[
    'portal.access','projects.view','invoices.view'
  ], false)
  RETURNING id INTO _client_profile;

  -- Backfill existing rows
  UPDATE public.equipment SET organization_id = _org_id, location_id = _loc_id WHERE organization_id IS NULL;
  UPDATE public.projects  SET organization_id = _org_id, location_id = _loc_id WHERE organization_id IS NULL;
  UPDATE public.invoices  SET organization_id = _org_id, location_id = _loc_id WHERE organization_id IS NULL;

  -- Promote existing first user to admin of Eurosom
  SELECT id INTO _existing_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF _existing_user IS NOT NULL THEN
    INSERT INTO public.user_locations (user_id, organization_id, location_id)
      VALUES (_existing_user, _org_id, _loc_id)
      ON CONFLICT DO NOTHING;
    INSERT INTO public.user_permission_profiles (user_id, organization_id, profile_id)
      VALUES (_existing_user, _org_id, _admin_profile)
      ON CONFLICT (user_id, organization_id) DO UPDATE SET profile_id = EXCLUDED.profile_id;
  END IF;
END $$;

-- Now make org/location NOT NULL on operational tables
ALTER TABLE public.equipment ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.projects  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.invoices  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_equipment_org_loc ON public.equipment(organization_id, location_id);
CREATE INDEX idx_projects_org_loc ON public.projects(organization_id, location_id);
CREATE INDEX idx_invoices_org_loc ON public.invoices(organization_id, location_id);

-- ----------------------------------------------------------------------------
-- 13. Update handle_new_user to assign default Cliente role on signup (no auto-admin)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  -- Onboarding to org/profile is done explicitly via /accept-invite or /register flows
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 14. RLS policies
-- ----------------------------------------------------------------------------

-- organizations: members see their orgs; super admins see all
CREATE POLICY "members view own orgs" ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_organization_ids()) OR public.is_super_admin());
CREATE POLICY "admins update own org" ON public.organizations FOR UPDATE TO authenticated
  USING ((id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin())
  WITH CHECK ((id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin());
CREATE POLICY "super admins create orgs" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- locations: members see locations of their orgs; admins manage
CREATE POLICY "members view org locations" ON public.locations FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()) OR public.is_super_admin());
CREATE POLICY "admins manage locations" ON public.locations FOR ALL TO authenticated
  USING ((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin())
  WITH CHECK ((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin());

-- user_locations: user sees own; admin manages within org
CREATE POLICY "view own user_locations" ON public.user_locations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin());
CREATE POLICY "admin manage user_locations" ON public.user_locations FOR ALL TO authenticated
  USING ((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin())
  WITH CHECK ((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin());

-- permission_profiles: members read; admin manage non-system
CREATE POLICY "members view profiles" ON public.permission_profiles FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()) OR public.is_super_admin());
CREATE POLICY "admin insert profiles" ON public.permission_profiles FOR INSERT TO authenticated
  WITH CHECK ((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin());
CREATE POLICY "admin update non-system profiles" ON public.permission_profiles FOR UPDATE TO authenticated
  USING (((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin()) AND is_system = false)
  WITH CHECK (((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin()) AND is_system = false);
CREATE POLICY "admin delete non-system profiles" ON public.permission_profiles FOR DELETE TO authenticated
  USING (((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin()) AND is_system = false);

-- user_permission_profiles
CREATE POLICY "view own upp" ON public.user_permission_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin());
CREATE POLICY "admin manage upp" ON public.user_permission_profiles FOR ALL TO authenticated
  USING ((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin())
  WITH CHECK ((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin());

-- super_admins: only super admins read; nothing else (managed via service role)
CREATE POLICY "super admins read super_admins" ON public.super_admins FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- sensitive_actions
CREATE POLICY "admins view org audit" ON public.sensitive_actions FOR SELECT TO authenticated
  USING ((organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin()) OR public.is_super_admin() OR user_id = auth.uid());
CREATE POLICY "system inserts audit" ON public.sensitive_actions FOR INSERT TO authenticated
  WITH CHECK (true);

-- auth_sessions
CREATE POLICY "view own sessions" ON public.auth_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "manage own sessions" ON public.auth_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 15. Refactor RLS on existing tables (multi-tenant + permission-aware)
-- ----------------------------------------------------------------------------

-- profiles: keep simple, allow same-org members to see each other's profile
DROP POLICY IF EXISTS "view own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
DROP POLICY IF EXISTS "admin insert profile" ON public.profiles;
CREATE POLICY "view org profiles" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_permission_profiles upp1
      JOIN public.user_permission_profiles upp2 ON upp1.organization_id = upp2.organization_id
      WHERE upp1.user_id = auth.uid() AND upp2.user_id = profiles.id
    )
  );
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- equipment
DROP POLICY IF EXISTS "staff manage equipment" ON public.equipment;
CREATE POLICY "view org equipment" ON public.equipment FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND (location_id IS NULL OR location_id IN (SELECT public.user_location_ids()) OR public.is_admin())
    AND public.user_has_permission('equipment.view')
  );
CREATE POLICY "manage org equipment" ON public.equipment FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_permission('equipment.manage')
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_permission('equipment.manage')
  );

-- projects
DROP POLICY IF EXISTS "staff manage projects" ON public.projects;
DROP POLICY IF EXISTS "clients view own projects" ON public.projects;
CREATE POLICY "view projects" ON public.projects FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      organization_id IN (SELECT public.user_organization_ids())
      AND (
        public.user_has_permission('projects.view')
        OR client_id = auth.uid()
      )
    )
  );
CREATE POLICY "manage projects" ON public.projects FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_permission('projects.manage')
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_permission('projects.manage')
  );

-- project_equipment
DROP POLICY IF EXISTS "staff manage project_equipment" ON public.project_equipment;
DROP POLICY IF EXISTS "clients view own project_equipment" ON public.project_equipment;
CREATE POLICY "view project_equipment" ON public.project_equipment FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_equipment.project_id
      AND (
        public.is_super_admin()
        OR (p.organization_id IN (SELECT public.user_organization_ids())
            AND (public.user_has_permission('projects.view') OR p.client_id = auth.uid()))
      )
  ));
CREATE POLICY "manage project_equipment" ON public.project_equipment FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_equipment.project_id
      AND p.organization_id IN (SELECT public.user_organization_ids())
      AND public.user_has_permission('projects.manage')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_equipment.project_id
      AND p.organization_id IN (SELECT public.user_organization_ids())
      AND public.user_has_permission('projects.manage')
  ));

-- crew_assignments
DROP POLICY IF EXISTS "staff manage crew" ON public.crew_assignments;
DROP POLICY IF EXISTS "view own assignments" ON public.crew_assignments;
CREATE POLICY "view crew" ON public.crew_assignments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.user_has_permission('crew.view')
    OR public.is_super_admin()
  );
CREATE POLICY "manage crew" ON public.crew_assignments FOR ALL TO authenticated
  USING (public.user_has_permission('crew.assign'))
  WITH CHECK (public.user_has_permission('crew.assign'));

-- invoices
DROP POLICY IF EXISTS "staff manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "clients view own invoices" ON public.invoices;
CREATE POLICY "view invoices" ON public.invoices FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      organization_id IN (SELECT public.user_organization_ids())
      AND (public.user_has_permission('invoices.view') OR client_id = auth.uid())
    )
  );
CREATE POLICY "manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_permission('invoices.manage')
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.user_has_permission('invoices.manage')
  );

-- ----------------------------------------------------------------------------
-- 16. Auto-enable RLS on any new public table (security guardrail)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE' AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.object_identity);
  END LOOP;
END;
$$;
DROP EVENT TRIGGER IF EXISTS rls_auto_enable_trigger;
CREATE EVENT TRIGGER rls_auto_enable_trigger
  ON ddl_command_end WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.rls_auto_enable();

-- ----------------------------------------------------------------------------
-- 17. Lock down execute on helpers
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_permission_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_data() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
