-- Fix RLS helper function and add bootstrap policy for tenant owner

-- A) Replace helper function with safer SQL function (no SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.is_tenant_member(tid uuid)
RETURNS boolean
LANGUAGE sql
SET search_path = 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_id = tid AND user_id = auth.uid()
    );
$$;

-- B) Bootstrap policy: allow tenant owner to insert their own membership row (owner role)

CREATE POLICY "tenant_members_bootstrap_owner" ON public.tenant_members
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'owner'
        AND EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_members.tenant_id
              AND t.owner_user_id = auth.uid()
        )
    );
