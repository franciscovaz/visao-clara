-- Fix RLS INSERT policy for tasks table
-- Issue: Current policy requires tenant_id in payload, but frontend may not send it
-- Solution: Allow insert if user is a member of the project's tenant

-- First, drop the existing insert policy if it exists
DROP POLICY IF EXISTS "tasks_insert_member" ON public.tasks;

-- Create improved INSERT policy that derives tenant access from project
CREATE POLICY "tasks_insert_member" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        -- User must be a member of the project's tenant
        public.is_tenant_member(
            (SELECT tenant_id FROM public.projects WHERE id = project_id)
        )
        -- Optional: ensure created_by matches current user if provided
        AND (created_by IS NULL OR created_by = auth.uid())
    );

-- Ensure the existing select policy is working (for reference)
-- This should already exist: SELECT if user is tenant member

-- Add helpful comment
COMMENT ON POLICY "tasks_insert_member" ON public.tasks IS 
    'Allows authenticated users to insert tasks only for projects they have access to via tenant membership';
