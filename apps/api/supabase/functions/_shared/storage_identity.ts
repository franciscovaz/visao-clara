// Trusted storage identity for document files.
//
// All tenants share one bucket, so the object key is the only isolation between them.
// A document_files row can be written by clients (until the hardening migration is applied)
// and by older code, so its storage columns are never trusted on their own: the key must
// sit under the prefix derived from the row's own immutable identifiers, and the bucket is
// always resolved from server configuration, never from the row.
//
// Pure module: no Deno or network APIs, so it can be unit-tested and bundled by the
// export Worker.

export type StorageProvider = "local_s3" | "r2";

export const STORAGE_PROVIDERS: readonly StorageProvider[] = ["local_s3", "r2"];

export const MAX_KEY_LENGTH = 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// deno-lint-ignore no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

export interface StorageIdentityRow {
  id: string;
  tenant_id: string;
  project_id: string;
  document_id: string;
  storage_provider?: string | null;
  storage_bucket?: string | null;
  storage_key?: string | null;
  // Legacy columns, written before the storage_* columns existed
  r2_bucket?: string | null;
  r2_key?: string | null;
}

/** Buckets configured on the server, per provider. A missing provider is not configured. */
export type ConfiguredBuckets = Partial<Record<StorageProvider, string | undefined>>;

export type StorageIdentityFailure =
  | "INVALID_IDENTITY" // one of the row identifiers is not a UUID
  | "PROVIDER_UNKNOWN" // provider missing or not local_s3 / r2
  | "PROVIDER_NOT_CONFIGURED" // no bucket configured on the server for this provider
  | "BUCKET_MISSING" // the row records no bucket
  | "BUCKET_INCONSISTENT" // storage_bucket and r2_bucket disagree
  | "BUCKET_MISMATCH" // the row's bucket is not the configured bucket
  | "KEY_MISSING"
  | "KEY_INCONSISTENT" // storage_key and r2_key disagree
  | "KEY_MALFORMED" // traversal, control characters, empty segments, too long...
  | "KEY_FOREIGN"; // key is not under this row's tenant/project/document/file prefix

export interface TrustedStorageObject {
  fileId: string;
  provider: StorageProvider;
  /** Always the server-configured bucket, never the value stored in the row */
  bucket: string;
  key: string;
}

export type StorageIdentityResult =
  | { ok: true; object: TrustedStorageObject }
  | { ok: false; reason: StorageIdentityFailure };

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function isProvider(value: unknown): value is StorageProvider {
  return typeof value === "string" && (STORAGE_PROVIDERS as readonly string[]).includes(value);
}

function present(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Key prefix every object of this file must live under. */
export function expectedKeyPrefix(
  ids: { tenant_id: string; project_id: string; document_id: string; id: string },
): string {
  return `${ids.tenant_id}/${ids.project_id}/${ids.document_id}/${ids.id}/`;
}

/** Last path segment of a key: the sanitised file name. Never contains "/" or traversal. */
export function isSafeKeySegment(segment: string): boolean {
  return segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("/") &&
    !segment.includes("\\") &&
    !CONTROL_CHARS_RE.test(segment);
}

/**
 * Builds the object key for a new file. The only place keys are created, so creation and
 * validation cannot drift apart. Returns null when the identifiers or the file name cannot
 * produce a key that validateObjectKey would accept.
 */
export function buildObjectKey(
  ids: { tenant_id: string; project_id: string; document_id: string; id: string },
  sanitizedFileName: string,
): string | null {
  if (!isUuid(ids.tenant_id) || !isUuid(ids.project_id) || !isUuid(ids.document_id) || !isUuid(ids.id)) {
    return null;
  }
  if (!isSafeKeySegment(sanitizedFileName)) return null;
  const key = `${expectedKeyPrefix(ids)}${sanitizedFileName}`;
  return key.length <= MAX_KEY_LENGTH ? key : null;
}

/**
 * Validates a key against the identity prefix. Returns the failure reason, or null if valid.
 * The key must be exactly `<prefix><file name>` where the file name is a single safe segment.
 */
export function validateObjectKey(
  key: string,
  ids: { tenant_id: string; project_id: string; document_id: string; id: string },
): "KEY_MALFORMED" | "KEY_FOREIGN" | null {
  if (key.length === 0 || key.length > MAX_KEY_LENGTH) return "KEY_MALFORMED";
  if (key.startsWith("/") || key.includes("\\") || CONTROL_CHARS_RE.test(key)) return "KEY_MALFORMED";

  const segments = key.split("/");
  // Empty segments ("//"), "." and ".." are rejected anywhere in the key
  if (segments.some((s) => s === "" || s === "." || s === "..")) return "KEY_MALFORMED";

  const prefix = expectedKeyPrefix(ids);
  if (!key.startsWith(prefix)) return "KEY_FOREIGN";

  // Exactly one segment after the prefix: <tenant>/<project>/<document>/<file>/<name>
  const rest = key.slice(prefix.length);
  if (!isSafeKeySegment(rest)) return "KEY_MALFORMED";

  return null;
}

/**
 * Resolves the storage location of a document_files row from trusted inputs only.
 *
 * - The provider recorded on the row is honoured (old local_s3 files are never silently
 *   redirected to the current provider) but must be a known provider that is configured.
 * - The bucket always comes from `configuredBuckets`; the row's bucket must equal it.
 * - The key must belong to the row's own tenant/project/document/file identity.
 * - Legacy r2_bucket / r2_key are accepted only when they agree with storage_* (or when
 *   storage_* is empty). Anything inconsistent fails closed.
 */
export function resolveTrustedStorageObject(
  row: StorageIdentityRow,
  configuredBuckets: ConfiguredBuckets,
): StorageIdentityResult {
  if (!isUuid(row.id) || !isUuid(row.tenant_id) || !isUuid(row.project_id) || !isUuid(row.document_id)) {
    return { ok: false, reason: "INVALID_IDENTITY" };
  }

  const provider = row.storage_provider;
  if (!isProvider(provider)) return { ok: false, reason: "PROVIDER_UNKNOWN" };

  const configuredBucket = configuredBuckets[provider];
  if (!present(configuredBucket)) return { ok: false, reason: "PROVIDER_NOT_CONFIGURED" };

  if (present(row.storage_bucket) && present(row.r2_bucket) && row.storage_bucket !== row.r2_bucket) {
    return { ok: false, reason: "BUCKET_INCONSISTENT" };
  }
  const rowBucket = present(row.storage_bucket) ? row.storage_bucket : row.r2_bucket;
  if (!present(rowBucket)) return { ok: false, reason: "BUCKET_MISSING" };
  if (rowBucket !== configuredBucket) return { ok: false, reason: "BUCKET_MISMATCH" };

  if (present(row.storage_key) && present(row.r2_key) && row.storage_key !== row.r2_key) {
    return { ok: false, reason: "KEY_INCONSISTENT" };
  }
  const rowKey = present(row.storage_key) ? row.storage_key : row.r2_key;
  if (!present(rowKey)) return { ok: false, reason: "KEY_MISSING" };

  const keyProblem = validateObjectKey(rowKey, row);
  if (keyProblem) return { ok: false, reason: keyProblem };

  return {
    ok: true,
    object: { fileId: row.id, provider, bucket: configuredBucket, key: rowKey },
  };
}
