-- Add company and city columns to responsibles table
ALTER TABLE public.responsibles
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS city text;
