-- Add tasks, expenses, and responsibles tables

-- A) public.responsibles
CREATE TABLE IF NOT EXISTS public.responsibles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    role text,
    email text,
    phone text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_responsibles_project_created_at ON public.responsibles(project_id, created_at DESC);
CREATE INDEX idx_responsibles_tenant_project ON public.responsibles(tenant_id, project_id);

-- B) public.tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    phase text NOT NULL DEFAULT 'planning' CHECK (phase IN ('planning', 'design', 'licensing', 'construction', 'finishes', 'general', 'done')),
    due_date date,
    is_done boolean NOT NULL DEFAULT false,
    responsible_id uuid REFERENCES public.responsibles(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_project_phase_done_due ON public.tasks(project_id, phase, is_done, due_date);
CREATE INDEX idx_tasks_tenant_project ON public.tasks(tenant_id, project_id);
CREATE INDEX idx_tasks_project_created_at ON public.tasks(project_id, created_at DESC);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Trigger on tasks
DROP TRIGGER IF EXISTS set_updated_at ON public.tasks;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- C) public.expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    amount_cents integer NOT NULL CHECK (amount_cents >= 0),
    currency text NOT NULL DEFAULT 'EUR',
    category text,
    expense_date date,
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'paid')),
    supplier_name text,
    responsible_id uuid REFERENCES public.responsibles(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_project_expense_date ON public.expenses(project_id, expense_date DESC);
CREATE INDEX idx_expenses_project_created_at ON public.expenses(project_id, created_at DESC);
CREATE INDEX idx_expenses_tenant_project ON public.expenses(tenant_id, project_id);
