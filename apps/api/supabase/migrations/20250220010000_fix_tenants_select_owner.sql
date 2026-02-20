-- Fix tenants RLS: allow owner to SELECT their own tenant during bootstrap

CREATE POLICY "tenants_select_owner" ON public.tenants
    FOR SELECT TO authenticated
    USING (owner_user_id = auth.uid());
