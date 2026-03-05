-- 1) Add new provider-agnostic columns
alter table public.document_files
  add column if not exists storage_provider text,
  add column if not exists storage_bucket text,
  add column if not exists storage_key text;

-- 2) Backfill from existing r2_* fields (keeps compatibility)
update public.document_files
set
  storage_provider = coalesce(storage_provider, 'r2'),
  storage_bucket   = coalesce(storage_bucket, r2_bucket),
  storage_key      = coalesce(storage_key, r2_key)
where
  storage_bucket is null
  or storage_key is null
  or storage_provider is null;

-- 3) Basic constraints (lightweight, safe)
alter table public.document_files
  alter column storage_provider set default 'local_s3';

-- Optional: you can add a CHECK later after you’re sure no other values exist
-- alter table public.document_files
--   add constraint document_files_storage_provider_check
--   check (storage_provider in ('local_s3', 'r2'));