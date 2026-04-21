-- Add completed column to tasks table for checklist feature

-- Add completed column with default false for existing rows
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

-- Add index for efficient filtering of completed/incomplete tasks
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON public.tasks(completed);

-- Add composite index for common checklist queries (project + completed status)
CREATE INDEX IF NOT EXISTS idx_tasks_project_completed ON public.tasks(project_id, completed);
