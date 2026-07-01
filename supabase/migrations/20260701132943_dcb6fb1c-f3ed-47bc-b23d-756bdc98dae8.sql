
CREATE OR REPLACE FUNCTION public.enforce_invite_only_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_invite boolean;
  _existing_users int;
BEGIN
  -- Bootstrap: allow the very first user (no accounts exist yet) to become the initial admin.
  SELECT count(*) INTO _existing_users FROM auth.users;
  IF _existing_users <= 1 THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.invites
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
  ) INTO _has_invite;

  IF NOT _has_invite THEN
    RAISE EXCEPTION 'A criação de conta é apenas por convite. Contacte o administrador.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invite_only_signup ON auth.users;
CREATE TRIGGER enforce_invite_only_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_only_signup();
