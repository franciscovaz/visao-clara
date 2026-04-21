-- FINAL FIX: Tasks RLS Policy for Multi-Tenant Schema
-- This migration fixes the RLS issues by creating proper INSERT and SELECT policies

-- Step 1: Ensure RLS is enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

-- Step 2: Drop all existing task policies to start fresh
DROP POLICY IF EXISTS "tasks_select_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_debug" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_debug" ON public.tasks;

-- Step 3: Create SELECT policy
-- Users can only see tasks from tenants they belong to
CREATE POLICY "tasks_select_member" ON public.tasks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tasks.tenant_id
            AND tm.user_id = auth.uid()
        )
    );

-- Step 4: Create INSERT policy
-- Users can insert tasks only if:
-- 1. They belong to the tenant
-- 2. The project exists in that tenant
-- 3. created_by matches the current user (if provided)
CREATE POLICY "tasks_insert_member" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        -- User must be a member of the task's tenant
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tasks.tenant_id
            AND tm.user_id = auth.uid()
        )
        -- The project must exist in the same tenant
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = tasks.project_id
            AND p.tenant_id = tasks.tenant_id
        )
        -- created_by must match current user if provided
        AND (tasks.created_by IS NULL OR tasks.created_by = auth.uid())
    );

-- Step 5: Create UPDATE policy
CREATE POLICY "tasks_update_member" ON public.tasks
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tasks.tenant_id
            AND tm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tasks.tenant_id
            AND tm.user_id = auth.uid()
        )
    );

-- Step 6: Create DELETE policy
CREATE POLICY "tasks_delete_member" ON public.tasks
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tasks.tenant_id
            AND tm.user_id = auth.uid()
        )
    );

-- Step 7: Verify policies were created
SELECT 
    policyname, 
    cmd,
    qual IS NOT NULL as has_using_expr,
    with_check IS NOT NULL as has_with_check_expr
FROM pg_policies 
WHERE tablename = 'tasks'
ORDER BY policyname;
