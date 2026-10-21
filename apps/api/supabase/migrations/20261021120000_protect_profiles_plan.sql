-- Prevent clients from setting or changing public.profiles.plan.
--
-- The profiles_insert_own / profiles_update_own RLS policies only restrict rows
-- (id = auth.uid()), not columns, and Supabase grants table-wide INSERT/UPDATE
-- to anon and authenticated. Any signed-in user could therefore run
-- `update profiles set plan = 'premium'` or insert their profile with a paid plan.
--
-- Replace the table-wide INSERT/UPDATE grants with column-level grants that
-- exclude plan (and created_at). Inserts that omit plan get the column default
-- ('free'). RLS policies are unchanged and still pin every write to the user's
-- own row. Existing rows are not modified.
--
-- plan can still be changed by postgres (Supabase SQL Editor) and service_role,
-- whose privileges are not affected.
--
-- NOTE: new client-editable columns on profiles must be added to both GRANTs
-- below in a future migration, otherwise client writes to them fail with 42501.

REVOKE INSERT, UPDATE ON TABLE public.profiles FROM anon, authenticated;

-- id is included because PostgREST upserts (ON CONFLICT DO UPDATE) set every
-- column in the payload; the RLS WITH CHECK (id = auth.uid()) keeps it immutable.
GRANT INSERT (id, full_name, avatar_url, first_name, last_name, phone, city, country, onboarding_completed_at)
    ON public.profiles TO authenticated;

GRANT UPDATE (id, full_name, avatar_url, first_name, last_name, phone, city, country, onboarding_completed_at)
    ON public.profiles TO authenticated;
