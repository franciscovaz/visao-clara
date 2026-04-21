-- Ensure SELECT policy exists for tasks (for completeness)
-- This allows authenticated users to read tasks from their tenant projects

-- Create SELECT policy if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tasks' 
        AND policyname = 'tasks_select_member'
    ) THEN
        CREATE POLICY "tasks_select_member" ON public.tasks
            FOR SELECT TO authenticated
            USING (public.is_tenant_member(tenant_id));
    END IF;
END
$$;
