
DROP POLICY IF EXISTS "view crew" ON public.crew_assignments;

CREATE POLICY "view crew" ON public.crew_assignments
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR user_has_permission('crew.view')
  OR user_has_permission('projects.manage')
);

CREATE OR REPLACE VIEW public.my_crew_assignments
WITH (security_invoker = true) AS
SELECT id, project_id, user_id, role, section, start_date, end_date, created_at
FROM public.crew_assignments
WHERE user_id = auth.uid();

GRANT SELECT ON public.my_crew_assignments TO authenticated;

DROP POLICY IF EXISTS "equipment read in org" ON storage.objects;
DROP POLICY IF EXISTS "equipment insert in org" ON storage.objects;
DROP POLICY IF EXISTS "equipment update in org" ON storage.objects;
DROP POLICY IF EXISTS "equipment delete in org" ON storage.objects;

CREATE POLICY "equipment read in org" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'equipment'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.user_organization_ids())
  AND (public.user_has_permission('equipment.view') OR public.user_has_permission('equipment.manage') OR public.is_super_admin())
);

CREATE POLICY "equipment insert in org" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'equipment'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.user_organization_ids())
  AND (public.user_has_permission('equipment.manage') OR public.is_super_admin())
);

CREATE POLICY "equipment update in org" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'equipment'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.user_organization_ids())
  AND (public.user_has_permission('equipment.manage') OR public.is_super_admin())
)
WITH CHECK (
  bucket_id = 'equipment'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.user_organization_ids())
  AND (public.user_has_permission('equipment.manage') OR public.is_super_admin())
);

CREATE POLICY "equipment delete in org" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'equipment'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT public.user_organization_ids())
  AND (public.user_has_permission('equipment.manage') OR public.is_super_admin())
);
