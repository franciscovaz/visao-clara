-- Debug helper to inspect auth context

CREATE OR REPLACE FUNCTION public.debug_auth_context()
RETURNS json
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT json_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'jwt_sub', current_setting('request.jwt.claim.sub', true),
    'jwt_role', current_setting('request.jwt.claim.role', true),
    'jwt_aud', current_setting('request.jwt.claim.aud', true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.debug_auth_context() TO authenticated;
