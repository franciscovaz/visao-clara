-- Fix RLS recursion: use SECURITY DEFINER with row_security = off

CREATE OR REPLACE FUNCTION public.is_tenant_member(tid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = tid
      AND tm.user_id = auth.uid()
  );
$$;
