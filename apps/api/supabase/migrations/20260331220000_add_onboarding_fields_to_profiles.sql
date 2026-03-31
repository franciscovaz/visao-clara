-- Add onboarding fields to existing profiles table
-- This migration adds fields to store onboarding data collected before authentication

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS project_type text,
ADD COLUMN IF NOT EXISTS project_description text,
ADD COLUMN IF NOT EXISTS property_type text,
ADD COLUMN IF NOT EXISTS property_description text,
ADD COLUMN IF NOT EXISTS current_phase text,
ADD COLUMN IF NOT EXISTS goal text,
ADD COLUMN IF NOT EXISTS budget text,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Add indexes for frequently queried onboarding fields
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed_at ON public.profiles(onboarding_completed_at) WHERE onboarding_completed_at IS NOT NULL;
