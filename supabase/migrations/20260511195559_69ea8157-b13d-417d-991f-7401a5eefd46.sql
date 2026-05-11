
-- Auto-bootstrap: first signup becomes Administrador of the (single) organization
-- and is added to all its locations. Subsequent signups land in NO org until invited.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_profile_id uuid;
  _org_id uuid;
  _existing_admins int;
BEGIN
  INSERT INTO public.profiles (id, full_name, company, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Bootstrap: if there are no users with the Administrador profile yet,
  -- promote this new signup to admin of the first organization.
  SELECT id INTO _admin_profile_id FROM public.permission_profiles
    WHERE is_system = true AND name = 'Administrador' LIMIT 1;

  IF _admin_profile_id IS NOT NULL THEN
    SELECT count(*) INTO _existing_admins
      FROM public.user_permission_profiles
      WHERE profile_id = _admin_profile_id;

    IF _existing_admins = 0 THEN
      SELECT id INTO _org_id FROM public.organizations ORDER BY created_at LIMIT 1;
      IF _org_id IS NOT NULL THEN
        INSERT INTO public.user_permission_profiles (user_id, organization_id, profile_id)
        VALUES (NEW.id, _org_id, _admin_profile_id)
        ON CONFLICT (user_id, organization_id) DO NOTHING;

        INSERT INTO public.user_locations (user_id, organization_id, location_id)
        SELECT NEW.id, _org_id, l.id FROM public.locations l WHERE l.organization_id = _org_id
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
