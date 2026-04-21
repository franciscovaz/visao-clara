-- DIAGNOSTIC AND FIX: Tasks RLS Policy
-- Run this in Supabase Studio SQL Editor (http://127.0.0.1:54323) if local migration isn't working

-- ============================================================================
-- STEP 1: Verify RLS is enabled on tasks table
-- ============================================================================
-- Check if RLS is enabled
SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as rls_forced
FROM pg_class 
WHERE relname = 'tasks';

-- If RLS is NOT enabled, enable it:
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner (optional but recommended)
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: List all existing policies on tasks
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,        -- ALL, SELECT, INSERT, UPDATE, DELETE
    qual,       -- USING expression
    with_check  -- WITH CHECK expression
FROM pg_policies 
WHERE tablename = 'tasks'
ORDER BY policyname;

-- ============================================================================
-- STEP 3: Drop and recreate the INSERT policy with correct condition
-- ============================================================================
-- Drop existing insert policy (if any)
DROP POLICY IF EXISTS "tasks_insert_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_all" ON public.tasks;

-- Create CORRECTED INSERT policy
-- This allows authenticated users to insert tasks for projects they belong to
CREATE POLICY "tasks_insert_member" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Must be authenticated
        auth.role() = 'authenticated'
        
        -- Must have access to the project via tenant membership
        AND EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.tenant_members tm ON tm.tenant_id = p.tenant_id
            WHERE p.id = project_id
            AND tm.user_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 4: TEMPORARY DEBUG POLICY (Optional - for testing only)
-- ============================================================================
-- Uncomment and run this if you want to bypass all checks temporarily
-- WARNING: Only for local development debugging!

-- DROP POLICY IF EXISTS "tasks_insert_debug" ON public.tasks;
-- CREATE POLICY "tasks_insert_debug" ON public.tasks
--     FOR INSERT TO authenticated
--     WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- STEP 5: Verify the policy was created
-- ============================================================================
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'tasks' AND policyname = 'tasks_insert_member';

-- ============================================================================
-- STEP 6: Test query - Check if user can access a specific project
-- ============================================================================
-- Replace with actual values to test:
-- SELECT * FROM public.projects WHERE id = 'your-project-id';
-- SELECT * FROM public.tenant_members WHERE user_id = auth.uid();

-- ============================================================================
-- STEP 7: Ensure SELECT policy exists (needed for returning inserted data)
-- ============================================================================
DROP POLICY IF EXISTS "tasks_select_member" ON public.tasks;

CREATE POLICY "tasks_select_member" ON public.tasks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.tenant_members tm ON tm.tenant_id = p.tenant_id
            WHERE p.id = project_id
            AND tm.user_id = auth.uid()
        )
    );

-- ============================================================================
-- NOTES:
-- ============================================================================
-- If you still get RLS errors after this:
-- 1. Check that the project_id you're inserting for actually exists
-- 2. Check that your user is in the tenant_members table for that project's tenant
-- 3. Check that you're sending a valid JWT token (authenticated)
-- 4. Check that created_by is either NULL or matches auth.uid()
