-- Multi-tenant core schema v1

-- Extensions

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tables

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    start_date date,
    end_date date,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes

CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_created_at ON public.projects(tenant_id, created_at DESC);

-- Helper function for RLS

CREATE OR REPLACE FUNCTION public.is_tenant_member(tid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    RETURN EXISTS (
        SELECT 1 FROM public.tenant_members tm
        WHERE tm.tenant_id = tid
          AND tm.user_id = auth.uid()
    );
$$;

-- RLS Policies

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_member" ON public.tenants
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(id));

CREATE POLICY "tenants_insert_owner" ON public.tenants
    FOR INSERT TO authenticated
    WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "tenants_update_owner" ON public.tenants
    FOR UPDATE TO authenticated
    USING (owner_user_id = auth.uid())
    WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "tenants_delete_owner" ON public.tenants
    FOR DELETE TO authenticated
    USING (owner_user_id = auth.uid());

-- Tenant members
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_select_member" ON public.tenant_members
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "tenant_members_insert_admin" ON public.tenant_members
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tenant_members.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "tenant_members_update_admin" ON public.tenant_members
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tenant_members.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tenant_members.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "tenant_members_delete_admin" ON public.tenant_members
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tenant_members.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('owner', 'admin')
        )
    );

-- Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_member" ON public.projects
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "projects_insert_member" ON public.projects
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_member(tenant_id) AND created_by = auth.uid());

CREATE POLICY "projects_update_member" ON public.projects
    FOR UPDATE TO authenticated
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "projects_delete_member" ON public.projects
    FOR DELETE TO authenticated
    USING (public.is_tenant_member(tenant_id));
