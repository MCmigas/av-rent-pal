
-- 1) Equipment bucket storage policies (bucket is now private)
DROP POLICY IF EXISTS "public read equipment files" ON storage.objects;
DROP POLICY IF EXISTS "auth upload equipment files" ON storage.objects;
DROP POLICY IF EXISTS "auth update equipment files" ON storage.objects;
DROP POLICY IF EXISTS "auth delete equipment files" ON storage.objects;

CREATE POLICY "equipment read in org"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'equipment'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "equipment insert in org"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'equipment'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "equipment update in org"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'equipment'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    bucket_id = 'equipment'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "equipment delete in org"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'equipment'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );

-- 2) Scope crew_assignments management to the project's organization
DROP POLICY IF EXISTS "manage crew" ON public.crew_assignments;

CREATE POLICY "manage crew"
  ON public.crew_assignments FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.user_has_permission('crew.assign')
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = crew_assignments.project_id
          AND p.organization_id IN (SELECT public.user_organization_ids())
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.user_has_permission('crew.assign')
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = crew_assignments.project_id
          AND p.organization_id IN (SELECT public.user_organization_ids())
      )
    )
  );

-- 3) Lock down SECURITY DEFINER functions: revoke broad EXECUTE, then re-grant
--    only the functions called directly from the app via RPC.
REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_equipment_availability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_project_status_availability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.convert_project_to_invoice(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.equipment_availability(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.equipment_booked_quantity(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_invite_by_token(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_organization_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_location_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_action(text, text, text, uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Re-grant only the RPCs the client actually calls
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_project_to_invoice(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_availability(uuid, timestamptz, timestamptz, uuid) TO authenticated;
