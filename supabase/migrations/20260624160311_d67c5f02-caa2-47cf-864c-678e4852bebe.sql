DROP POLICY IF EXISTS "view crew" ON public.crew_assignments;
CREATE POLICY "view crew" ON public.crew_assignments FOR SELECT
USING (
  is_super_admin()
  OR (
    (user_has_permission('crew.view') OR user_has_permission('projects.manage'))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = crew_assignments.project_id
        AND p.organization_id IN (SELECT user_organization_ids())
    )
  )
);

DROP POLICY IF EXISTS "users insert own audit" ON public.sensitive_actions;
CREATE POLICY "users insert own audit" ON public.sensitive_actions FOR INSERT
WITH CHECK (user_id = auth.uid());