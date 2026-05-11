
-- invites table
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.permission_profiles(id),
  location_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invites_email_idx ON public.invites (lower(email));
CREATE INDEX invites_org_idx ON public.invites (organization_id);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view org invites" ON public.invites
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin())
  );

CREATE POLICY "admins create org invites" ON public.invites
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin())
  );

CREATE POLICY "admins delete org invites" ON public.invites
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (organization_id IN (SELECT public.user_organization_ids()) AND public.is_admin())
  );

-- public RPC: lookup invite by token (no auth required)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  email text,
  organization_id uuid,
  organization_name text,
  profile_id uuid,
  profile_name text,
  expires_at timestamptz,
  accepted_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.email, i.organization_id, o.name, i.profile_id, p.name,
         i.expires_at, i.accepted_at
  FROM public.invites i
  JOIN public.organizations o ON o.id = i.organization_id
  JOIN public.permission_profiles p ON p.id = i.profile_id
  WHERE i.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon, authenticated;

-- accept invite (must be authenticated; email must match)
CREATE OR REPLACE FUNCTION public.accept_invite(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite public.invites;
  _user_email text;
  _loc uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tem de iniciar sessão para aceitar o convite';
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO _invite FROM public.invites WHERE token = _token;
  IF _invite.id IS NULL THEN
    RAISE EXCEPTION 'Convite inválido';
  END IF;
  IF _invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Convite já aceite';
  END IF;
  IF _invite.expires_at < now() THEN
    RAISE EXCEPTION 'Convite expirado';
  END IF;
  IF lower(_invite.email) <> lower(_user_email) THEN
    RAISE EXCEPTION 'O email do convite não corresponde à sua conta';
  END IF;

  INSERT INTO public.user_permission_profiles (user_id, organization_id, profile_id)
  VALUES (auth.uid(), _invite.organization_id, _invite.profile_id)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET profile_id = EXCLUDED.profile_id;

  FOREACH _loc IN ARRAY _invite.location_ids LOOP
    INSERT INTO public.user_locations (user_id, organization_id, location_id)
    VALUES (auth.uid(), _invite.organization_id, _loc)
    ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE public.invites
     SET accepted_at = now(), accepted_by = auth.uid()
   WHERE id = _invite.id;

  RETURN _invite.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(uuid) TO authenticated;
