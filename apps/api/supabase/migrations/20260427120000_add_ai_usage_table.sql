-- Add AI usage tracking for checklist suggestions
-- Quotas: Free=2/month, Pro=100/month, Premium=100/month
-- Quotas are per-user, based on profiles.plan

-- Create ai_usage table (aggregated monthly usage)
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month date NOT NULL, -- First day of UTC month (e.g., 2026-04-01)
    generation_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, month)
);

-- Create ai_reservations table (per-request reservations)
CREATE TABLE IF NOT EXISTS public.ai_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month date NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
    UNIQUE (id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month ON public.ai_usage(user_id, month);
CREATE INDEX IF NOT EXISTS idx_ai_reservations_user_month ON public.ai_reservations(user_id, month);
CREATE INDEX IF NOT EXISTS idx_ai_reservations_status_expires ON public.ai_reservations(status, expires_at) WHERE status = 'pending';

-- Triggers (reuse existing set_updated_at function from 20250222223800_add_tasks_expenses_responsibles.sql)
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_usage;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.ai_usage
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_reservations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.ai_reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Function to get quota limit based on plan
CREATE OR REPLACE FUNCTION public.get_ai_quota_limit(plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE plan
        WHEN 'free' THEN 2
        WHEN 'pro' THEN 100
        WHEN 'premium' THEN 100
        ELSE 2 -- Default to free quota
    END;
$$;

-- Service role function to create a quota reservation
-- SECURITY DEFINER: Accepts user_id parameter, uses row-level lock on profiles for serialization
-- Acquires lock on user's profile row BEFORE checking quota to prevent concurrent overbooking
-- Counts both completed usage and pending reservations
-- Returns (reservation_id: uuid, success: boolean, used: integer, "limit": integer, remaining: integer)
CREATE OR REPLACE FUNCTION public.reserve_ai_generation_service(p_user_id uuid)
RETURNS TABLE (reservation_id uuid, success boolean, used integer, "limit" integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan text;
    v_limit integer;
    v_completed_count integer;
    v_pending_count integer;
    v_total_in_use integer;
    v_reservation_id uuid;
    v_current_month date;
BEGIN
    -- Get current UTC month
    v_current_month := date_trunc('month', now() at time zone 'utc')::date;

    -- Acquire row-level lock on user's profile for serialization
    -- This prevents concurrent transactions from checking quota simultaneously
    SELECT plan INTO v_plan
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found for user_id: %', p_user_id;
    END IF;

    v_limit := public.get_ai_quota_limit(v_plan);

    -- Get completed usage count
    SELECT COALESCE(generation_count, 0) INTO v_completed_count
    FROM public.ai_usage
    WHERE user_id = p_user_id AND month = v_current_month;

    -- Count pending reservations (non-expired)
    SELECT COALESCE(COUNT(*), 0) INTO v_pending_count
    FROM public.ai_reservations
    WHERE user_id = p_user_id
      AND month = v_current_month
      AND status = 'pending'
      AND expires_at > now();

    -- Total in use = completed + pending
    v_total_in_use := v_completed_count + v_pending_count;

    -- Check quota
    IF v_total_in_use >= v_limit THEN
        success := false;
        used := v_completed_count;
        "limit" := v_limit;
        remaining := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Create reservation (does not increment usage yet)
    v_reservation_id := gen_random_uuid();
    INSERT INTO public.ai_reservations (id, user_id, month, status)
    VALUES (v_reservation_id, p_user_id, v_current_month, 'pending');

    success := true;
    used := v_completed_count;
    "limit" := v_limit;
    remaining := v_limit - v_total_in_use;
    reservation_id := v_reservation_id;
    RETURN NEXT;
END;
$$;

-- Service role function to finalize a reservation (successful generation)
-- SECURITY DEFINER: Accepts user_id parameter, verifies ownership
-- Cannot finalize expired reservations
CREATE OR REPLACE FUNCTION public.finalize_ai_reservation_service(p_reservation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reservation_month date;
    v_reservation_user_id uuid;
    v_reservation_status text;
    v_reservation_expires timestamptz;
BEGIN
    -- Get reservation details with row-level lock
    SELECT user_id, month, status, expires_at INTO v_reservation_user_id, v_reservation_month, v_reservation_status, v_reservation_expires
    FROM public.ai_reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false; -- Reservation not found
    END IF;

    -- Verify ownership
    IF v_reservation_user_id != p_user_id THEN
        RETURN false; -- Ownership mismatch
    END IF;

    -- Check if already processed
    IF v_reservation_status != 'pending' THEN
        RETURN false; -- Already processed
    END IF;

    -- Check if expired
    IF v_reservation_expires < now() THEN
        RETURN false; -- Cannot finalize expired reservation
    END IF;

    -- Mark reservation as completed
    UPDATE public.ai_reservations
    SET status = 'completed', updated_at = now()
    WHERE id = p_reservation_id;

    -- Increment usage count
    INSERT INTO public.ai_usage (user_id, month, generation_count)
    VALUES (p_user_id, v_reservation_month, 1)
    ON CONFLICT (user_id, month)
    DO UPDATE SET
        generation_count = ai_usage.generation_count + 1,
        updated_at = now();

    RETURN true;
END;
$$;

-- Service role function to release a reservation (failed generation)
-- SECURITY DEFINER: Accepts user_id parameter, verifies ownership
CREATE OR REPLACE FUNCTION public.release_ai_reservation_service(p_reservation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reservation_user_id uuid;
    v_reservation_status text;
BEGIN
    -- Get reservation details with row-level lock
    SELECT user_id, status INTO v_reservation_user_id, v_reservation_status
    FROM public.ai_reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false; -- Reservation not found
    END IF;

    -- Verify ownership
    IF v_reservation_user_id != p_user_id THEN
        RETURN false; -- Ownership mismatch
    END IF;

    -- Check if already processed
    IF v_reservation_status != 'pending' THEN
        RETURN false; -- Already processed
    END IF;

    -- Mark reservation as failed
    UPDATE public.ai_reservations
    SET status = 'failed', updated_at = now()
    WHERE id = p_reservation_id;

    RETURN true;
END;
$$;

-- Service role function to clean up expired reservations
-- SECURITY DEFINER: Idempotent cleanup of expired pending reservations
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations_service()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Mark expired pending reservations as failed
    UPDATE public.ai_reservations
    SET status = 'failed', updated_at = now()
    WHERE status = 'pending'
      AND expires_at < now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Function to get current month's usage for authenticated user
-- SECURITY DEFINER: Uses auth.uid() internally
CREATE OR REPLACE FUNCTION public.get_ai_usage()
RETURNS TABLE (generation_count integer, quota_limit integer, remaining integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(au.generation_count, 0) as generation_count,
        public.get_ai_quota_limit(p.plan) as quota_limit,
        public.get_ai_quota_limit(p.plan) - COALESCE(au.generation_count, 0) as remaining
    FROM public.profiles p
    LEFT JOIN public.ai_usage au ON au.user_id = p.id AND au.month = date_trunc('month', now() at time zone 'utc')::date
    WHERE p.id = auth.uid();
$$;

-- Revoke EXECUTE from PUBLIC, anon, authenticated for all quota functions
REVOKE EXECUTE ON FUNCTION public.reserve_ai_generation_service(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_ai_generation_service(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_ai_generation_service(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.finalize_ai_reservation_service(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_ai_reservation_service(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_ai_reservation_service(uuid, uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.release_ai_reservation_service(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_ai_reservation_service(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_ai_reservation_service(uuid, uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_reservations_service() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_reservations_service() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_reservations_service() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_ai_usage() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ai_usage() FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_ai_quota_limit(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ai_quota_limit(text) FROM anon;

-- Grant EXECUTE permissions
-- Authenticated role can call read-only usage function
GRANT EXECUTE ON FUNCTION public.get_ai_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_quota_limit(text) TO authenticated;

-- Service role functions for reservation mutations (restricted to service role)
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation_service(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_ai_reservation_service(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_reservation_service(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reservations_service() TO service_role;

-- Enable RLS
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reservations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "ai_usage_select_own" ON public.ai_usage
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can only see their own reservations
CREATE POLICY "ai_reservations_select_own" ON public.ai_reservations
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users cannot insert/update/delete directly (only through functions)
-- RLS denies by default, so explicit deny policies are optional but added for clarity
CREATE POLICY "ai_usage_no_insert" ON public.ai_usage
    FOR INSERT TO authenticated
    WITH CHECK (false);

CREATE POLICY "ai_usage_no_update" ON public.ai_usage
    FOR UPDATE TO authenticated
    USING (false);

CREATE POLICY "ai_usage_no_delete" ON public.ai_usage
    FOR DELETE TO authenticated
    USING (false);

CREATE POLICY "ai_reservations_no_insert" ON public.ai_reservations
    FOR INSERT TO authenticated
    WITH CHECK (false);

CREATE POLICY "ai_reservations_no_update" ON public.ai_reservations
    FOR UPDATE TO authenticated
    USING (false);

CREATE POLICY "ai_reservations_no_delete" ON public.ai_reservations
    FOR DELETE TO authenticated
    USING (false);
