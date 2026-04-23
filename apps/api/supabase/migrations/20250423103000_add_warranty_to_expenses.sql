-- Add warranty_expires_at column to expenses table
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS warranty_expires_at date;
