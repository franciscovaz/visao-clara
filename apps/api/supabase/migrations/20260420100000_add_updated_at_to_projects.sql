-- Add updated_at column to projects table with automatic update trigger

-- Add updated_at column to projects table
ALTER TABLE public.projects 
ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Create trigger function for updated_at (reuse existing pattern from tasks)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Create trigger on projects to automatically update updated_at
DROP TRIGGER IF EXISTS set_updated_at_projects ON public.projects;
CREATE TRIGGER set_updated_at_projects
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Add index for updated_at for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
