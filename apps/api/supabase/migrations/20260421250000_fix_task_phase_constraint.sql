-- Fix: Add RLS policies for tasks table to work with proper tenant-based auth
-- AND ensure phase values align with the constraint

-- First, ensure RLS is enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "tasks_select_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_member" ON public.tasks;

-- SELECT policy: Users can view tasks from their tenant
CREATE POLICY "tasks_select_member" ON public.tasks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tasks.tenant_id
            AND tm.user_id = auth.uid()
        )
    );

-- INSERT policy: Users can insert tasks for their tenant
CREATE POLICY "tasks_insert_member" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tasks.tenant_id
            AND tm.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = tasks.project_id
            AND p.tenant_id = tasks.tenant_id
        )
    );

-- UPDATE policy
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

-- DELETE policy
CREATE POLICY "tasks_delete_member" ON public.tasks
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_members tm
            WHERE tm.tenant_id = tasks.tenant_id
            AND tm.user_id = auth.uid()
        )
    );

-- Verify the constraint exists and has correct values
-- The constraint should be: CHECK (phase IN ('planning', 'design', 'licensing', 'construction', 'finishes', 'general', 'done'))
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'tasks_phase_check';
