-- S1 hardening: document storage integrity (cross-tenant object access).
--
-- NOT APPLIED YET: review first. Must be applied TOGETHER with the Edge Function changes
-- (r2-sign-upload, r2-confirm-upload, delete-document, cleanup-pending-uploads), which write
-- document_files with the service role instead of the user's JWT. Applying it without those
-- functions (or the functions without it) breaks uploads: see "Rollout" at the end.
--
-- Problem: all tenants share one storage bucket, so the object key is the only isolation.
-- Until now any tenant member could INSERT or UPDATE document_files rows (storage_key,
-- r2_key, status, and on insert also bucket/provider) and then ask r2-sign-download or the
-- export Worker for a signed URL / ZIP entry of any key in the bucket.
--
-- What this migration does
--   1. Clients (authenticated) lose INSERT and UPDATE on document_files; they keep SELECT.
--      Row creation and status changes become server-only (service_role), after the Edge
--      Function has verified the user's access.
--   2. service_role gets exactly what the functions need: INSERT, and UPDATE of
--      (status, uploaded_at) only. Nobody but the table owner can change a stored key,
--      bucket, provider or identity column afterwards.
--   3. Integrity constraints, added NOT VALID so legacy rows never block the migration, and
--      validated automatically at the end when no existing row violates them:
--        - documents.project_id must belong to documents.tenant_id
--        - document_files (document_id, tenant_id, project_id) must match its document
--        - storage_provider is local_s3 or r2
--        - storage_key / r2_key must be <tenant>/<project>/<document>/<file id>/<name>, a
--          single safe segment (no "." / "..", no control characters, no backslash)
--        - a file can only be 'uploaded' if it has provider, bucket and key
--   4. Status transitions: a 'deleted' file can never change status again, and no file can
--      go back to 'pending'.
--
-- Existing rows are never modified by this migration.
-- RLS policies are unchanged. The document_files INSERT/UPDATE policies stay in place but
-- are unreachable for clients without the table privileges (defence in depth).

-- ---------------------------------------------------------------------------
-- 0. Report legacy rows that violate the new rules (informational, never aborts)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    n_scope bigint;
    n_provider bigint;
    n_key bigint;
    n_rkey bigint;
    n_proj bigint;
BEGIN
    SELECT count(*) INTO n_proj
    FROM public.documents d
    JOIN public.projects p ON p.id = d.project_id
    WHERE p.tenant_id <> d.tenant_id;

    SELECT count(*) INTO n_scope
    FROM public.document_files f
    JOIN public.documents d ON d.id = f.document_id
    WHERE d.tenant_id <> f.tenant_id OR d.project_id <> f.project_id;

    SELECT count(*) INTO n_provider
    FROM public.document_files
    WHERE storage_provider IS NOT NULL AND storage_provider NOT IN ('local_s3', 'r2');

    SELECT count(*) INTO n_key
    FROM public.document_files f
    WHERE f.storage_key IS NOT NULL
      AND f.storage_key !~ ('^' || f.tenant_id::text || '/' || f.project_id::text || '/' ||
                            f.document_id::text || '/' || f.id::text || '/[^/]+$');

    SELECT count(*) INTO n_rkey
    FROM public.document_files f
    WHERE f.r2_key IS NOT NULL
      AND f.r2_key !~ ('^' || f.tenant_id::text || '/' || f.project_id::text || '/' ||
                       f.document_id::text || '/' || f.id::text || '/[^/]+$');

    RAISE NOTICE 'document storage audit: documents in a project of another tenant=%, files not matching their document=%, unknown provider=%, storage_key outside own prefix=%, r2_key outside own prefix=%',
        n_proj, n_scope, n_provider, n_key, n_rkey;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Tenant / project / document consistency
-- ---------------------------------------------------------------------------
-- Targets of the composite foreign keys (id is already unique, so these never reject data)
ALTER TABLE public.projects
    ADD CONSTRAINT projects_id_tenant_id_key UNIQUE (id, tenant_id);

ALTER TABLE public.documents
    ADD CONSTRAINT documents_id_tenant_project_key UNIQUE (id, tenant_id, project_id);

ALTER TABLE public.documents
    ADD CONSTRAINT documents_project_tenant_fkey
    FOREIGN KEY (project_id, tenant_id) REFERENCES public.projects (id, tenant_id)
    ON DELETE CASCADE NOT VALID;

ALTER TABLE public.document_files
    ADD CONSTRAINT document_files_document_scope_fkey
    FOREIGN KEY (document_id, tenant_id, project_id) REFERENCES public.documents (id, tenant_id, project_id)
    ON DELETE CASCADE NOT VALID;

-- ---------------------------------------------------------------------------
-- 2. Storage metadata integrity
-- ---------------------------------------------------------------------------
ALTER TABLE public.document_files
    ADD CONSTRAINT document_files_storage_provider_check
    CHECK (storage_provider IN ('local_s3', 'r2')) NOT VALID;

-- The key must be exactly <tenant>/<project>/<document>/<file id>/<one segment>. The
-- identifiers are uuids (hex and "-"), so they are safe to embed in the pattern.
ALTER TABLE public.document_files
    ADD CONSTRAINT document_files_storage_key_identity_check
    CHECK (
        storage_key IS NULL OR (
            storage_key ~ ('^' || tenant_id::text || '/' || project_id::text || '/' ||
                           document_id::text || '/' || id::text || '/[^/]+$')
            AND length(storage_key) <= 1024
            AND storage_key !~ '(^|/)\.{1,2}(/|$)'
            AND storage_key !~ '[[:cntrl:]]'
            AND strpos(storage_key, chr(92)) = 0
        )
    ) NOT VALID;

ALTER TABLE public.document_files
    ADD CONSTRAINT document_files_r2_key_identity_check
    CHECK (
        r2_key IS NULL OR (
            r2_key ~ ('^' || tenant_id::text || '/' || project_id::text || '/' ||
                      document_id::text || '/' || id::text || '/[^/]+$')
            AND length(r2_key) <= 1024
            AND r2_key !~ '(^|/)\.{1,2}(/|$)'
            AND r2_key !~ '[[:cntrl:]]'
            AND strpos(r2_key, chr(92)) = 0
        )
    ) NOT VALID;

ALTER TABLE public.document_files
    ADD CONSTRAINT document_files_uploaded_has_location_check
    CHECK (
        status <> 'uploaded' OR (
            storage_provider IS NOT NULL AND storage_bucket IS NOT NULL AND storage_key IS NOT NULL
        )
    ) NOT VALID;

-- ---------------------------------------------------------------------------
-- 3. Status transitions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.document_files_enforce_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'deleted' THEN
            RAISE EXCEPTION 'document_files: a deleted file cannot change status'
                USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.status = 'pending' THEN
            RAISE EXCEPTION 'document_files: status cannot go back to pending'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger function only: no API role may call it directly
REVOKE ALL ON FUNCTION public.document_files_enforce_status_transition() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER document_files_status_transition
    BEFORE UPDATE OF status ON public.document_files
    FOR EACH ROW
    EXECUTE FUNCTION public.document_files_enforce_status_transition();

-- ---------------------------------------------------------------------------
-- 4. Privileges
-- ---------------------------------------------------------------------------
-- Clients can no longer create document_files rows or change their state/storage key.
-- They keep SELECT (the documents page checks for an uploaded file before downloading).
REVOKE INSERT ON public.document_files FROM authenticated;
REVOKE UPDATE (status, uploaded_at, r2_key, storage_key) ON public.document_files FROM authenticated;

-- Edge Functions (service role), only after verifying the user's access:
--   r2-sign-upload          INSERT (pending row with its final key)
--   r2-confirm-upload       UPDATE status, uploaded_at
--   delete-document         UPDATE status (tombstone)
--   cleanup-pending-uploads UPDATE status
-- SELECT was already granted for the export Worker.
GRANT INSERT ON public.document_files TO service_role;
GRANT UPDATE (status, uploaded_at) ON public.document_files TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Validate the new constraints against existing rows where possible
--    (a violation leaves the constraint NOT VALID: it still guards new and updated rows)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT * FROM (VALUES
            ('public.documents', 'documents_project_tenant_fkey'),
            ('public.document_files', 'document_files_document_scope_fkey'),
            ('public.document_files', 'document_files_storage_provider_check'),
            ('public.document_files', 'document_files_storage_key_identity_check'),
            ('public.document_files', 'document_files_r2_key_identity_check'),
            ('public.document_files', 'document_files_uploaded_has_location_check')
        ) AS t(tbl, name)
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tbl, c.name);
            RAISE NOTICE 'validated %.%', c.tbl, c.name;
        EXCEPTION WHEN check_violation OR foreign_key_violation THEN
            RAISE NOTICE 'NOT validated %.% (existing rows violate it; new rows are still checked)', c.tbl, c.name;
        END;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Self-check: abort (and roll back this migration) if privileges are not as intended
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    col text;
BEGIN
    IF has_table_privilege('authenticated', 'public.document_files', 'INSERT')
       OR has_table_privilege('authenticated', 'public.document_files', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.document_files', 'DELETE')
       OR NOT has_table_privilege('authenticated', 'public.document_files', 'SELECT') THEN
        RAISE EXCEPTION 'S1 self-check failed: authenticated must have SELECT only on document_files';
    END IF;

    FOR col IN
        SELECT attname::text FROM pg_attribute
        WHERE attrelid = 'public.document_files'::regclass AND attnum > 0 AND NOT attisdropped
    LOOP
        IF has_column_privilege('authenticated', 'public.document_files', col, 'UPDATE')
           OR has_column_privilege('authenticated', 'public.document_files', col, 'INSERT') THEN
            RAISE EXCEPTION 'S1 self-check failed: authenticated can write document_files.%', col;
        END IF;

        IF has_column_privilege('service_role', 'public.document_files', col, 'UPDATE')
           AND col NOT IN ('status', 'uploaded_at') THEN
            RAISE EXCEPTION 'S1 self-check failed: service_role can update document_files.%', col;
        END IF;
    END LOOP;

    IF NOT has_table_privilege('service_role', 'public.document_files', 'INSERT')
       OR NOT has_table_privilege('service_role', 'public.document_files', 'SELECT')
       OR NOT has_column_privilege('service_role', 'public.document_files', 'status', 'UPDATE')
       OR NOT has_column_privilege('service_role', 'public.document_files', 'uploaded_at', 'UPDATE') THEN
        RAISE EXCEPTION 'S1 self-check failed: service_role is missing a privilege the Edge Functions need';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollout
--   Order: apply this migration, then (re)start `supabase functions serve`. The new
--   functions need the service_role grants above; the old functions need the client grants
--   removed here. There is no ordering in which both versions work at once, so apply both
--   in the same maintenance window.
--   Rollback (manual, if ever needed): GRANT INSERT ON public.document_files TO authenticated;
--   GRANT UPDATE (status, uploaded_at, r2_key, storage_key) ON public.document_files TO
--   authenticated; and redeploy the previous functions. The constraints can stay.
-- ---------------------------------------------------------------------------
