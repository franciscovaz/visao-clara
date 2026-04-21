-- QUICK FIX: Run this directly in Supabase Studio SQL Editor
-- http://127.0.0.1:54323/project/default/sql/new

-- 1. Enable RLS on tasks (in case it's not enabled)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 2. Drop all existing insert policies to avoid conflicts
DROP POLICY IF EXISTS "tasks_insert_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_debug" ON public.tasks;

-- 3. Create a working INSERT policy
-- This uses the existing is_tenant_member function but checks via the project
CREATE POLICY "tasks_insert_member" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_tenant_member(
            (SELECT tenant_id FROM public.projects WHERE id = project_id)
        )
    );

-- 4. Ensure SELECT policy exists too (so you can read back inserted rows)
DROP POLICY IF EXISTS "tasks_select_member" ON public.tasks;

CREATE POLICY "tasks_select_member" ON public.tasks
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- 5. Verify policies were created
SELECT policyname, cmd, with_check 
FROM pg_policies 
WHERE tablename = 'tasks';
