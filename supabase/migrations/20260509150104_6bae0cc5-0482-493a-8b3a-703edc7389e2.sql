
-- Tighten sensitive_actions insert
DROP POLICY IF EXISTS "system inserts audit" ON public.sensitive_actions;
CREATE POLICY "users insert own audit" ON public.sensitive_actions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Fix search_path on rls_auto_enable
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE' AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.object_identity);
  END LOOP;
END;
$$;

-- Revoke anon execute on helper functions; keep for authenticated since RLS needs them
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_organization_ids(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_location_ids(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_action(text, text, text, uuid, uuid, uuid, text, jsonb) FROM anon, PUBLIC;
