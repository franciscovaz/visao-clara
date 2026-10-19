-- Add AI Chat Assistant tables and functions
-- Quotas: Free=10/month, Pro=100/month, Premium=300/month
-- Independent from AI Checklist Suggestions quota

-- Create ai_chat_usage table (aggregated monthly usage)
CREATE TABLE IF NOT EXISTS public.ai_chat_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month date NOT NULL, -- First day of UTC month (e.g., 2026-04-01)
    message_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, month)
);

-- Create ai_chat_reservations table (per-request reservations)
CREATE TABLE IF NOT EXISTS public.ai_chat_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month date NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
    UNIQUE (id)
);

-- Create ai_chat_conversations table (one per user per project)
CREATE TABLE IF NOT EXISTS public.ai_chat_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, project_id)
);

-- Create ai_chat_messages table (messages in conversations)
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_chat_usage_user_month ON public.ai_chat_usage(user_id, month);
CREATE INDEX IF NOT EXISTS idx_ai_chat_reservations_user_month ON public.ai_chat_reservations(user_id, month);
CREATE INDEX IF NOT EXISTS idx_ai_chat_reservations_status_expires ON public.ai_chat_reservations(status, expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_project ON public.ai_chat_conversations(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user ON public.ai_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_created ON public.ai_chat_messages(conversation_id, created_at ASC);

-- Triggers (reuse existing set_updated_at function)
DROP TRIGGER IF EXISTS set_updated_at ON public.ai_chat_usage;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.ai_chat_usage
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_chat_reservations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.ai_chat_reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_chat_conversations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.ai_chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Function to get chat quota limit based on plan
CREATE OR REPLACE FUNCTION public.get_ai_chat_quota_limit(plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE plan
        WHEN 'free' THEN 10
        WHEN 'pro' THEN 100
        WHEN 'premium' THEN 300
        ELSE 10 -- Default to free quota
    END;
$$;

-- Service role function to create a chat quota reservation
-- SECURITY DEFINER: Accepts user_id parameter, uses row-level lock on profiles for serialization
-- Acquires lock on user's profile row BEFORE checking quota to prevent concurrent overbooking
-- Counts both completed usage and pending reservations
-- Returns (reservation_id: uuid, success: boolean, used: integer, "limit": integer, remaining: integer)
CREATE OR REPLACE FUNCTION public.reserve_ai_chat_generation_service(p_user_id uuid)
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

    v_limit := public.get_ai_chat_quota_limit(v_plan);

    -- Get completed usage count (handle NULL when no row exists)
    SELECT COALESCE(
        (SELECT message_count FROM public.ai_chat_usage
         WHERE user_id = p_user_id AND month = v_current_month),
        0
    ) INTO v_completed_count;

    -- Count pending reservations (non-expired)
    SELECT COALESCE(COUNT(*), 0) INTO v_pending_count
    FROM public.ai_chat_reservations
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
    INSERT INTO public.ai_chat_reservations (id, user_id, month, status)
    VALUES (v_reservation_id, p_user_id, v_current_month, 'pending');

    success := true;
    used := v_completed_count;
    "limit" := v_limit;
    remaining := v_limit - v_total_in_use;
    reservation_id := v_reservation_id;
    RETURN NEXT;
END;
$$;

-- Service role function to atomically persist messages and finalize reservation
-- SECURITY DEFINER: Validates reservation, conversation ownership, inserts both messages, finalizes, increments usage
-- All operations in a single transaction - any failure rolls back all changes
-- Returns (user_message_id: uuid, assistant_message_id: uuid, success: boolean)
CREATE OR REPLACE FUNCTION public.finalize_ai_chat_with_messages_service(
    p_reservation_id uuid,
    p_user_id uuid,
    p_conversation_id uuid,
    p_user_message text,
    p_assistant_message text
)
RETURNS TABLE (user_message_id uuid, assistant_message_id uuid, success boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reservation_month date;
    v_reservation_user_id uuid;
    v_reservation_status text;
    v_reservation_expires timestamptz;
    v_conversation_user_id uuid;
    v_user_message_id uuid;
    v_assistant_message_id uuid;
BEGIN
    -- Get reservation details with row-level lock
    SELECT user_id, month, status, expires_at INTO v_reservation_user_id, v_reservation_month, v_reservation_status, v_reservation_expires
    FROM public.ai_chat_reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        success := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Verify ownership
    IF v_reservation_user_id != p_user_id THEN
        success := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check if already processed
    IF v_reservation_status != 'pending' THEN
        success := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check if expired
    IF v_reservation_expires < now() THEN
        success := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Verify conversation ownership
    SELECT user_id INTO v_conversation_user_id
    FROM public.ai_chat_conversations
    WHERE id = p_conversation_id;

    IF NOT FOUND OR v_conversation_user_id != p_user_id THEN
        success := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Insert user message
    v_user_message_id := gen_random_uuid();
    INSERT INTO public.ai_chat_messages (id, conversation_id, role, content)
    VALUES (v_user_message_id, p_conversation_id, 'user', p_user_message);

    -- Insert assistant message
    v_assistant_message_id := gen_random_uuid();
    INSERT INTO public.ai_chat_messages (id, conversation_id, role, content)
    VALUES (v_assistant_message_id, p_conversation_id, 'assistant', p_assistant_message);

    -- Mark reservation as completed
    UPDATE public.ai_chat_reservations
    SET status = 'completed', updated_at = now()
    WHERE id = p_reservation_id;

    -- Increment usage count
    INSERT INTO public.ai_chat_usage (user_id, month, message_count)
    VALUES (p_user_id, v_reservation_month, 1)
    ON CONFLICT (user_id, month)
    DO UPDATE SET
        message_count = ai_chat_usage.message_count + 1,
        updated_at = now();

    user_message_id := v_user_message_id;
    assistant_message_id := v_assistant_message_id;
    success := true;
    RETURN NEXT;
END;
$$;

-- Service role function to release a chat reservation (failed generation)
-- SECURITY DEFINER: Accepts user_id parameter, verifies ownership
CREATE OR REPLACE FUNCTION public.release_ai_chat_reservation_service(p_reservation_id uuid, p_user_id uuid)
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
    FROM public.ai_chat_reservations
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
    UPDATE public.ai_chat_reservations
    SET status = 'failed', updated_at = now()
    WHERE id = p_reservation_id;

    RETURN true;
END;
$$;

-- Service role function to clean up expired chat reservations
-- SECURITY DEFINER: Idempotent cleanup of expired pending reservations
CREATE OR REPLACE FUNCTION public.cleanup_ai_chat_expired_reservations_service()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Mark expired pending reservations as failed
    UPDATE public.ai_chat_reservations
    SET status = 'failed', updated_at = now()
    WHERE status = 'pending'
      AND expires_at < now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Function to get current month's chat usage for authenticated user
-- SECURITY DEFINER: Uses auth.uid() internally
CREATE OR REPLACE FUNCTION public.get_ai_chat_usage()
RETURNS TABLE (message_count integer, quota_limit integer, remaining integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(acu.message_count, 0) as message_count,
        public.get_ai_chat_quota_limit(p.plan) as quota_limit,
        public.get_ai_chat_quota_limit(p.plan) - COALESCE(acu.message_count, 0) as remaining
    FROM public.profiles p
    LEFT JOIN public.ai_chat_usage acu ON acu.user_id = p.id AND acu.month = date_trunc('month', now() at time zone 'utc')::date
    WHERE p.id = auth.uid();
$$;

-- Revoke EXECUTE from PUBLIC, anon, authenticated for all chat quota functions
REVOKE EXECUTE ON FUNCTION public.reserve_ai_chat_generation_service(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_ai_chat_generation_service(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_ai_chat_generation_service(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.finalize_ai_chat_with_messages_service(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_ai_chat_with_messages_service(uuid, uuid, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_ai_chat_with_messages_service(uuid, uuid, uuid, text, text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.release_ai_chat_reservation_service(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_ai_chat_reservation_service(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_ai_chat_reservation_service(uuid, uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_ai_chat_expired_reservations_service() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_ai_chat_expired_reservations_service() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_ai_chat_expired_reservations_service() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_ai_chat_usage() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ai_chat_usage() FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_ai_chat_quota_limit(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ai_chat_quota_limit(text) FROM anon;

-- Grant EXECUTE permissions
-- Authenticated role can call read-only usage function
GRANT EXECUTE ON FUNCTION public.get_ai_chat_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_chat_quota_limit(text) TO authenticated;

-- Service role functions for reservation mutations (restricted to service role)
GRANT EXECUTE ON FUNCTION public.reserve_ai_chat_generation_service(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_ai_chat_with_messages_service(uuid, uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_chat_reservation_service(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_ai_chat_expired_reservations_service() TO service_role;

-- Enable RLS
ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own chat usage
CREATE POLICY "ai_chat_usage_select_own" ON public.ai_chat_usage
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can only see their own chat reservations
CREATE POLICY "ai_chat_reservations_select_own" ON public.ai_chat_reservations
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can only see their own conversations
CREATE POLICY "ai_chat_conversations_select_own" ON public.ai_chat_conversations
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can only see messages in their own conversations
CREATE POLICY "ai_chat_messages_select_own" ON public.ai_chat_messages
    FOR SELECT TO authenticated
    USING (
        conversation_id IN (
            SELECT id FROM public.ai_chat_conversations
            WHERE user_id = auth.uid()
        )
    );

-- Users cannot insert/update/delete directly (only through functions)
CREATE POLICY "ai_chat_usage_no_insert" ON public.ai_chat_usage
    FOR INSERT TO authenticated
    WITH CHECK (false);

CREATE POLICY "ai_chat_usage_no_update" ON public.ai_chat_usage
    FOR UPDATE TO authenticated
    USING (false);

CREATE POLICY "ai_chat_usage_no_delete" ON public.ai_chat_usage
    FOR DELETE TO authenticated
    USING (false);

CREATE POLICY "ai_chat_reservations_no_insert" ON public.ai_chat_reservations
    FOR INSERT TO authenticated
    WITH CHECK (false);

CREATE POLICY "ai_chat_reservations_no_update" ON public.ai_chat_reservations
    FOR UPDATE TO authenticated
    USING (false);

CREATE POLICY "ai_chat_reservations_no_delete" ON public.ai_chat_reservations
    FOR DELETE TO authenticated
    USING (false);

CREATE POLICY "ai_chat_conversations_no_insert" ON public.ai_chat_conversations
    FOR INSERT TO authenticated
    WITH CHECK (false);

CREATE POLICY "ai_chat_conversations_no_update" ON public.ai_chat_conversations
    FOR UPDATE TO authenticated
    USING (false);

CREATE POLICY "ai_chat_conversations_no_delete" ON public.ai_chat_conversations
    FOR DELETE TO authenticated
    USING (false);

CREATE POLICY "ai_chat_messages_no_insert" ON public.ai_chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (false);

CREATE POLICY "ai_chat_messages_no_update" ON public.ai_chat_messages
    FOR UPDATE TO authenticated
    USING (false);

CREATE POLICY "ai_chat_messages_no_delete" ON public.ai_chat_messages
    FOR DELETE TO authenticated
    USING (false);
