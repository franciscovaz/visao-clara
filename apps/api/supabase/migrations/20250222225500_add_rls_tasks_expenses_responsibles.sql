-- Enable RLS and add policies for responsibles, tasks, and expenses

-- A) Enable RLS

ALTER TABLE public.responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- B) Policies for public.responsibles

CREATE POLICY "responsibles_select_member" ON public.responsibles
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "responsibles_insert_member" ON public.responsibles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "responsibles_update_member" ON public.responsibles
    FOR UPDATE TO authenticated
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "responsibles_delete_member" ON public.responsibles
    FOR DELETE TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- C) Policies for public.tasks

CREATE POLICY "tasks_select_member" ON public.tasks
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "tasks_insert_member" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_member(tenant_id) AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "tasks_update_member" ON public.tasks
    FOR UPDATE TO authenticated
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "tasks_delete_member" ON public.tasks
    FOR DELETE TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- D) Policies for public.expenses

CREATE POLICY "expenses_select_member" ON public.expenses
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "expenses_insert_member" ON public.expenses
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_member(tenant_id) AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "expenses_update_member" ON public.expenses
    FOR UPDATE TO authenticated
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "expenses_delete_member" ON public.expenses
    FOR DELETE TO authenticated
    USING (public.is_tenant_member(tenant_id));
