-- Corrective migration: Move onboarding fields from profiles to projects
-- Previous migration incorrectly added business/onboarding fields to user profiles

-- 1) Remove wrong onboarding fields from public.profiles
-- These fields belong at project level, not user level

ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS project_type,
DROP COLUMN IF EXISTS project_description,
DROP COLUMN IF EXISTS property_type,
DROP COLUMN IF EXISTS property_description,
DROP COLUMN IF EXISTS current_phase,
DROP COLUMN IF EXISTS goal,
DROP COLUMN IF EXISTS budget;

-- Keep onboarding_completed_at in profiles as it represents user-level state
-- This timestamp indicates when the user completed the onboarding process
-- It's user metadata, not project-specific data

-- Drop index that only existed for wrongly placed onboarding fields
DROP INDEX IF EXISTS public.idx_profiles_onboarding_completed_at;

-- 2) Add correct onboarding fields to public.projects
-- These fields describe the specific project, not the user

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_type text,
ADD COLUMN IF NOT EXISTS project_description text,
ADD COLUMN IF NOT EXISTS property_type text,
ADD COLUMN IF NOT EXISTS property_description text,
ADD COLUMN IF NOT EXISTS current_phase text,
ADD COLUMN IF NOT EXISTS goal text,
ADD COLUMN IF NOT EXISTS budget text;

-- Add indexes for project-level onboarding fields for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON public.projects(project_type) WHERE project_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_current_phase ON public.projects(current_phase) WHERE current_phase IS NOT NULL;
