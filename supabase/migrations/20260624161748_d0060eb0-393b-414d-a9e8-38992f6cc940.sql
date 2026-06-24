-- Table for project attachment metadata
CREATE TABLE public.project_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_name text NOT NULL,
  content_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.project_attachments TO authenticated;
GRANT ALL ON public.project_attachments TO service_role;

ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their orgs"
  ON public.project_attachments
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "Users can add attachments in their orgs"
  ON public.project_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "Users can delete attachments in their orgs"
  ON public.project_attachments
  FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Storage RLS for project-attachments bucket
CREATE POLICY "Org members can read project attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'project-attachments' AND (
    public.is_super_admin() OR
    SPLIT_PART(name, '/', 1)::uuid IN (SELECT public.user_organization_ids())
  ));

CREATE POLICY "Org members can upload project attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-attachments' AND (
    public.is_super_admin() OR
    SPLIT_PART(name, '/', 1)::uuid IN (SELECT public.user_organization_ids())
  ));

CREATE POLICY "Org members can delete project attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'project-attachments' AND (
    public.is_super_admin() OR
    SPLIT_PART(name, '/', 1)::uuid IN (SELECT public.user_organization_ids())
  ));