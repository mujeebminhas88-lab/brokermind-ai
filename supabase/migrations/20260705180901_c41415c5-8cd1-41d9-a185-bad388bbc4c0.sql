
REVOKE EXECUTE ON FUNCTION public.is_firm_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_firm_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_firm_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_firm_id() TO authenticated;
