
-- These are referenced inside RLS policies and must be executable by the calling role.
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_organization_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_location_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_booked_quantity(uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sensitive_action(text, text, text, uuid, uuid, uuid, text, jsonb) TO authenticated;
