-- Explicit, minimal API privileges for anon, authenticated and service_role.
--
-- WHY
--   Until now the schema relied on Supabase's *default privileges*, which gave anon,
--   authenticated and service_role full access (including TRUNCATE) to every table
--   created in public. New Supabase projects can disable that default
--   ("Automatically expose new tables"); on such a project the earlier migrations
--   would create tables that the Data API (PostgREST, supabase-js, Edge Functions,
--   the export Worker) cannot reach at all (42501 permission denied, before RLS).
--
--   This migration states the privileges the application needs explicitly, so the
--   result is identical on a project with automatic exposure ON (DEV) or OFF (PROD),
--   and it removes everything that is not needed.
--
-- WHAT IT DOES
--   1. Resets privileges of anon / authenticated / service_role on the 17 known
--      tables (only those; any other object in public is left untouched).
--   2. Grants back only what the current code uses (derived from every .from() /
--      .rpc() call in apps/web, the Edge Functions and the export Worker).
--   3. Restricts EXECUTE on the public functions.
--   4. Makes future tables, sequences and functions in public start with no
--      privileges for the three API roles (they need an explicit GRANT).
--   5. Fails the migration (and rolls it back) if the resulting privileges differ
--      from the matrix below.
--
-- NOT CHANGED
--   * RLS policies (RLS stays the row-level boundary; grants are the table-level one).
--   * profiles.plan stays write-protected: the column-level INSERT/UPDATE grants of
--     20261021120000_protect_profiles_plan.sql are re-created below (REVOKE ALL on a
--     table also removes column privileges, so they must be granted again).
--   * Trigger function public.set_updated_at() is intentionally not touched: it
--     cannot be called through the API (trigger functions are not callable as RPC).
--   * Roles other than anon / authenticated / service_role (postgres, supabase_*).
--   * USAGE on schema public for anon (platform default; anon gets no table or
--     function privileges below, so it can read and call nothing).
--
-- Any new client-facing table, column or function now needs its own GRANT in the
-- migration that creates it.

-- ---------------------------------------------------------------------------
-- 1. Schema access
--    authenticated and service_role need USAGE on public to reach any object in it.
--    No CREATE is granted to any API role.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Reset table privileges (known tables only)
--    Also removes column-level privileges, e.g. on profiles.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE
    public.profiles,
    public.tenants,
    public.tenant_members,
    public.projects,
    public.tasks,
    public.expenses,
    public.responsibles,
    public.documents,
    public.document_files,
    public.expense_documents,
    public.feedback,
    public.ai_usage,
    public.ai_reservations,
    public.ai_chat_usage,
    public.ai_chat_reservations,
    public.ai_chat_conversations,
    public.ai_chat_messages
FROM anon, authenticated, service_role;

-- anon: nothing. Unauthenticated visitors only use Supabase Auth endpoints.

-- ---------------------------------------------------------------------------
-- 3. authenticated (browser via supabase-js, and Edge Functions using the user's JWT)
--    Every statement below is still filtered by the existing RLS policies.
--    SELECT is needed wherever rows are read, returned by INSERT/UPDATE (RETURNING),
--    used in WHERE clauses of UPDATE/DELETE, or referenced inside RLS subqueries.
-- ---------------------------------------------------------------------------

-- profiles: read own profile; insert/update only the listed columns.
-- plan and created_at are deliberately absent (plans are assigned in the SQL Editor).
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (id, full_name, avatar_url, first_name, last_name, phone, city, country, onboarding_completed_at)
    ON public.profiles TO authenticated;
GRANT UPDATE (id, full_name, avatar_url, first_name, last_name, phone, city, country, onboarding_completed_at)
    ON public.profiles TO authenticated;

-- Onboarding creates the tenant (INSERT ... RETURNING id) and the owner membership.
-- No UPDATE/DELETE: tenants and memberships are never changed by the app.
GRANT SELECT, INSERT ON public.tenants        TO authenticated;
GRANT SELECT, INSERT ON public.tenant_members TO authenticated;

-- Project data. No DELETE: the app never deletes these rows (project removal and
-- task/expense/responsible deletion do not exist yet).
GRANT SELECT, INSERT, UPDATE ON public.projects     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tasks        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.expenses     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.responsibles TO authenticated;

-- Documents: created by r2-sign-upload / the documents page, deleted by delete-document.
-- Child rows (document_files, expense_documents) are removed by ON DELETE CASCADE,
-- which runs as the table owner and needs no DELETE grant on the children.
GRANT SELECT, INSERT, DELETE ON public.documents TO authenticated;

-- document_files: the client may only change the upload state and the storage key
-- (set by r2-sign-upload right after insert; status/uploaded_at by confirm, cleanup
-- and delete-document). It cannot repoint bucket/provider, or move a file record to
-- another tenant, project or document.
GRANT SELECT, INSERT ON public.document_files TO authenticated;
GRANT UPDATE (status, uploaded_at, r2_key, storage_key) ON public.document_files TO authenticated;

-- feedback: write-only for users (INSERT without RETURNING; never read back by the app).
GRANT INSERT ON public.feedback TO authenticated;

-- AI chat history is read through ai-chat-assistant with the user's JWT (the select
-- embeds ai_chat_messages). Writes happen only through service_role / SECURITY DEFINER
-- functions.
GRANT SELECT ON public.ai_chat_conversations TO authenticated;
GRANT SELECT ON public.ai_chat_messages      TO authenticated;

-- No access for authenticated (reachable only through SECURITY DEFINER functions):
--   ai_usage, ai_reservations, ai_chat_usage, ai_chat_reservations
--   expense_documents (no code path uses it yet)

-- ---------------------------------------------------------------------------
-- 4. service_role (Edge Functions with the service key, export Worker)
--    The AI quota RPCs are SECURITY DEFINER and run as the owner, so they need no
--    table privileges. Direct table access is limited to what the code does today.
-- ---------------------------------------------------------------------------

-- ai-chat-assistant: create/find the (user, project) conversation after quota reservation.
GRANT SELECT, INSERT ON public.ai_chat_conversations TO service_role;
-- get-project-expenses-xlsx: reads one tenant/project's expenses after verifying the export JWT.
GRANT SELECT ON public.expenses TO service_role;
-- export-documents-worker: lists uploaded files of one tenant/project after verifying the export JWT.
GRANT SELECT ON public.document_files TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Functions (EXECUTE)
--    Postgres grants EXECUTE to PUBLIC by default; every function is reset
--    explicitly. Signatures must match the migrations that created them.
-- ---------------------------------------------------------------------------

-- Used inside RLS policies, which are evaluated as the authenticated role.
REVOKE ALL ON FUNCTION public.is_tenant_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated;

-- Called by the frontend / Edge Functions with the user's JWT; return the caller's own usage.
REVOKE ALL ON FUNCTION public.get_ai_usage()      FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_ai_chat_usage() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_usage()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_chat_usage() TO authenticated;

-- Quota/reservation functions: service_role only (called by the AI Edge Functions after
-- the user is verified). They take p_user_id as a parameter, so they must never be
-- callable by authenticated.
REVOKE ALL ON FUNCTION public.reserve_ai_generation_service(uuid)                FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_ai_reservation_service(uuid, uuid)        FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_ai_reservation_service(uuid, uuid)         FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cleanup_expired_reservations_service()            FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_ai_chat_generation_service(uuid)           FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_ai_chat_with_messages_service(uuid, uuid, uuid, text, text)
                                                                                 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_ai_chat_reservation_service(uuid, uuid)    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cleanup_ai_chat_expired_reservations_service()     FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation_service(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_ai_reservation_service(uuid, uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_reservation_service(uuid, uuid)         TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reservations_service()            TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_ai_chat_generation_service(uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_ai_chat_with_messages_service(uuid, uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_chat_reservation_service(uuid, uuid)    TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_ai_chat_expired_reservations_service()     TO service_role;

-- Not called by any application code (only inside SECURITY DEFINER functions, which run
-- as the owner) or unused debug helper: no API role needs EXECUTE.
REVOKE ALL ON FUNCTION public.get_ai_quota_limit(text)      FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_ai_chat_quota_limit(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.debug_auth_context()          FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Defaults for objects created later by the postgres role in public
--    Removes the automatic grants to the API roles, so a missing GRANT shows up in
--    DEV exactly as it would in PROD. (No sequences exist today: all primary keys use
--    gen_random_uuid().) New functions remain executable by PUBLIC unless the creating
--    migration revokes it, because PUBLIC's default cannot be removed per schema.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Self-check: abort (and roll back this migration) if the effective privileges
--    do not match the matrix above exactly.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    api_roles text[] := ARRAY['anon', 'authenticated', 'service_role'];
    tbls text[] := ARRAY[
        'profiles', 'tenants', 'tenant_members', 'projects', 'tasks', 'expenses',
        'responsibles', 'documents', 'document_files', 'expense_documents', 'feedback',
        'ai_usage', 'ai_reservations', 'ai_chat_usage', 'ai_chat_reservations',
        'ai_chat_conversations', 'ai_chat_messages'
    ];
    privs text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
    -- role.table.privilege that must hold (table-level; column grants are checked separately)
    expected_table text[] := ARRAY[
        'authenticated.profiles.SELECT',
        'authenticated.tenants.SELECT', 'authenticated.tenants.INSERT',
        'authenticated.tenant_members.SELECT', 'authenticated.tenant_members.INSERT',
        'authenticated.projects.SELECT', 'authenticated.projects.INSERT', 'authenticated.projects.UPDATE',
        'authenticated.tasks.SELECT', 'authenticated.tasks.INSERT', 'authenticated.tasks.UPDATE',
        'authenticated.expenses.SELECT', 'authenticated.expenses.INSERT', 'authenticated.expenses.UPDATE',
        'authenticated.responsibles.SELECT', 'authenticated.responsibles.INSERT', 'authenticated.responsibles.UPDATE',
        'authenticated.documents.SELECT', 'authenticated.documents.INSERT', 'authenticated.documents.DELETE',
        'authenticated.document_files.SELECT', 'authenticated.document_files.INSERT',
        'authenticated.feedback.INSERT',
        'authenticated.ai_chat_conversations.SELECT',
        'authenticated.ai_chat_messages.SELECT',
        'service_role.ai_chat_conversations.SELECT', 'service_role.ai_chat_conversations.INSERT',
        'service_role.expenses.SELECT',
        'service_role.document_files.SELECT'
    ];
    -- function signature, then the only API role allowed to EXECUTE it ('' = none)
    fn_sigs text[] := ARRAY[
        'public.is_tenant_member(uuid)',
        'public.get_ai_usage()',
        'public.get_ai_chat_usage()',
        'public.reserve_ai_generation_service(uuid)',
        'public.finalize_ai_reservation_service(uuid, uuid)',
        'public.release_ai_reservation_service(uuid, uuid)',
        'public.cleanup_expired_reservations_service()',
        'public.reserve_ai_chat_generation_service(uuid)',
        'public.finalize_ai_chat_with_messages_service(uuid, uuid, uuid, text, text)',
        'public.release_ai_chat_reservation_service(uuid, uuid)',
        'public.cleanup_ai_chat_expired_reservations_service()',
        'public.get_ai_quota_limit(text)',
        'public.get_ai_chat_quota_limit(text)',
        'public.debug_auth_context()'
    ];
    fn_role text[] := ARRAY[
        'authenticated', 'authenticated', 'authenticated',
        'service_role', 'service_role', 'service_role', 'service_role',
        'service_role', 'service_role', 'service_role', 'service_role',
        '', '', ''
    ];
    profile_columns text[] := ARRAY[
        'id', 'full_name', 'avatar_url', 'first_name', 'last_name', 'phone', 'city', 'country',
        'onboarding_completed_at'
    ];
    file_update_columns text[] := ARRAY['status', 'uploaded_at', 'r2_key', 'storage_key'];
    r text;
    t text;
    p text;
    c text;
    k text;
    i int;
    actual boolean;
    wanted boolean;
BEGIN
    -- Table-level privileges: every role x table x privilege must match the matrix.
    FOREACH r IN ARRAY api_roles LOOP
        FOREACH t IN ARRAY tbls LOOP
            FOREACH p IN ARRAY privs LOOP
                k := r || '.' || t || '.' || p;
                actual := has_table_privilege(r, format('public.%I', t), p);
                wanted := k = ANY (expected_table);
                IF actual IS DISTINCT FROM wanted THEN
                    RAISE EXCEPTION 'grant audit failed for %: has=%, expected=%', k, actual, wanted;
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;

    -- profiles: plan (and created_at) must never be writable by an API role;
    -- the editable columns must be writable by authenticated.
    FOREACH r IN ARRAY api_roles LOOP
        FOREACH c IN ARRAY ARRAY['plan', 'created_at'] LOOP
            IF has_column_privilege(r, 'public.profiles', c, 'INSERT')
               OR has_column_privilege(r, 'public.profiles', c, 'UPDATE') THEN
                RAISE EXCEPTION 'grant audit failed: % can write profiles.%', r, c;
            END IF;
        END LOOP;
    END LOOP;
    FOREACH c IN ARRAY profile_columns LOOP
        IF NOT (has_column_privilege('authenticated', 'public.profiles', c, 'INSERT')
                AND has_column_privilege('authenticated', 'public.profiles', c, 'UPDATE')) THEN
            RAISE EXCEPTION 'grant audit failed: authenticated cannot write profiles.%', c;
        END IF;
    END LOOP;

    -- document_files: authenticated may update exactly the four listed columns.
    FOR c IN
        SELECT attname::text FROM pg_attribute
        WHERE attrelid = 'public.document_files'::regclass AND attnum > 0 AND NOT attisdropped
    LOOP
        actual := has_column_privilege('authenticated', 'public.document_files', c, 'UPDATE');
        wanted := c = ANY (file_update_columns);
        IF actual IS DISTINCT FROM wanted THEN
            RAISE EXCEPTION 'grant audit failed: authenticated UPDATE on document_files.%: has=%, expected=%',
                c, actual, wanted;
        END IF;
    END LOOP;

    -- Functions: EXECUTE (including the implicit PUBLIC grant) per role.
    FOR i IN 1 .. array_length(fn_sigs, 1) LOOP
        FOREACH r IN ARRAY api_roles LOOP
            actual := has_function_privilege(r, fn_sigs[i], 'EXECUTE');
            wanted := r = fn_role[i];
            IF actual IS DISTINCT FROM wanted THEN
                RAISE EXCEPTION 'grant audit failed: % EXECUTE on %: has=%, expected=%',
                    r, fn_sigs[i], actual, wanted;
            END IF;
        END LOOP;
    END LOOP;
END
$$;
