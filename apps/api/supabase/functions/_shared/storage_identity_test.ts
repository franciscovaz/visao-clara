// Run from apps/api/supabase/functions: deno test _shared/storage_identity_test.ts _shared/document_guards_test.ts
import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  buildObjectKey,
  type ConfiguredBuckets,
  expectedKeyPrefix,
  resolveTrustedStorageObject,
  type StorageIdentityRow,
  validateObjectKey,
} from "./storage_identity.ts";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOC_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DOC_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const FILE_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const FILE_B = "99999999-9999-4999-8999-999999999999";

const BUCKETS: ConfiguredBuckets = { local_s3: "local-bucket", r2: "r2-bucket" };
const IDS = { tenant_id: TENANT_A, project_id: PROJECT_A, document_id: DOC_A, id: FILE_A };
const VALID_KEY = `${TENANT_A}/${PROJECT_A}/${DOC_A}/${FILE_A}/contrato.pdf`;

function row(overrides: Partial<StorageIdentityRow> = {}): StorageIdentityRow {
  return {
    ...IDS,
    storage_provider: "r2",
    storage_bucket: "r2-bucket",
    storage_key: VALID_KEY,
    r2_bucket: "r2-bucket",
    r2_key: VALID_KEY,
    ...overrides,
  };
}

function reason(r: StorageIdentityRow, buckets = BUCKETS) {
  const result = resolveTrustedStorageObject(r, buckets);
  return result.ok ? "OK" : result.reason;
}

Deno.test("valid r2 and local_s3 records resolve to the configured bucket", () => {
  const r2 = resolveTrustedStorageObject(row(), BUCKETS);
  assertEquals(r2.ok && r2.object, { fileId: FILE_A, provider: "r2", bucket: "r2-bucket", key: VALID_KEY });

  const local = resolveTrustedStorageObject(
    row({ storage_provider: "local_s3", storage_bucket: "local-bucket", r2_bucket: "local-bucket" }),
    BUCKETS,
  );
  assertEquals(local.ok && local.object.provider, "local_s3");
  assertEquals(local.ok && local.object.bucket, "local-bucket");
});

Deno.test("legacy rows with only r2_bucket / r2_key are accepted", () => {
  assertEquals(reason(row({ storage_bucket: null, storage_key: null })), "OK");
});

Deno.test("file names may contain spaces, accents and dots", () => {
  const key = `${expectedKeyPrefix(IDS)}Relatório final v1.2 (cópia).pdf`;
  assertEquals(reason(row({ storage_key: key, r2_key: key })), "OK");
});

Deno.test("cross-tenant key substitution is refused", () => {
  const foreign = `${TENANT_B}/${PROJECT_B}/${DOC_B}/${FILE_B}/segredo.pdf`;
  assertEquals(reason(row({ storage_key: foreign, r2_key: foreign })), "KEY_FOREIGN");
  // Same tenant id but a different project / document / file
  for (const other of [
    `${TENANT_A}/${PROJECT_B}/${DOC_A}/${FILE_A}/x.pdf`,
    `${TENANT_A}/${PROJECT_A}/${DOC_B}/${FILE_A}/x.pdf`,
    `${TENANT_A}/${PROJECT_A}/${DOC_A}/${FILE_B}/x.pdf`,
  ]) {
    assertEquals(reason(row({ storage_key: other, r2_key: other })), "KEY_FOREIGN");
  }
});

Deno.test("a row whose own identity is foreign cannot reach another prefix", () => {
  // Attacker inserts a row claiming the victim's ids: the prefix then needs the victim's ids,
  // which the identity columns (and RLS on tenant_id) do not allow the attacker to claim for storage
  const victimKey = `${TENANT_B}/${PROJECT_B}/${DOC_B}/${FILE_B}/segredo.pdf`;
  assertEquals(reason(row({ storage_key: victimKey, r2_key: victimKey })), "KEY_FOREIGN");
});

Deno.test("prefix tricks are refused", () => {
  for (const key of [
    `${TENANT_A}/${PROJECT_A}/${DOC_A}/${FILE_A}`, // no file name
    `${TENANT_A}/${PROJECT_A}/${DOC_A}/${FILE_A}/`, // empty file name
    `${TENANT_A}/${PROJECT_A}/${DOC_A}/${FILE_A}x/contrato.pdf`, // prefix of another file id
    `${TENANT_A}/${PROJECT_A}/${DOC_A}/${FILE_A}/sub/contrato.pdf`, // extra segment
  ]) {
    const result = reason(row({ storage_key: key, r2_key: key }));
    assertEquals(result === "KEY_FOREIGN" || result === "KEY_MALFORMED", true, key);
  }
});

Deno.test("path traversal and malformed keys are refused", () => {
  const prefix = expectedKeyPrefix(IDS);
  const bad = [
    `${prefix}..`,
    `${prefix}.`,
    `${prefix}../../${TENANT_B}/${PROJECT_B}/${DOC_B}/${FILE_B}/x.pdf`,
    `${prefix}a/../b.pdf`,
    `${TENANT_A}/${PROJECT_A}/${DOC_A}/${FILE_A}/./x.pdf`,
    `${TENANT_A}/${PROJECT_A}/../${PROJECT_A}/${DOC_A}/${FILE_A}/x.pdf`,
    `${prefix}a//b.pdf`,
    `/${prefix}x.pdf`,
    `${prefix}a\\b.pdf`,
    `${prefix}x\u0000.pdf`,
    `${prefix}x\n.pdf`,
    `${prefix}${"a".repeat(1100)}`,
    "",
  ];
  for (const key of bad) {
    const result = validateObjectKey(key, IDS);
    assertEquals(result !== null, true, JSON.stringify(key));
    assertEquals(reason(row({ storage_key: key, r2_key: key })) === "OK", false, JSON.stringify(key));
  }
});

Deno.test("percent-encoded traversal is a literal file name, not a traversal", () => {
  // Signing percent-encodes "%" so this stays one literal segment
  assertEquals(validateObjectKey(`${expectedKeyPrefix(IDS)}%2e%2e`, IDS), null);
});

Deno.test("wrong bucket is refused, and the row's bucket is never used", () => {
  assertEquals(reason(row({ storage_bucket: "other-bucket", r2_bucket: "other-bucket" })), "BUCKET_MISMATCH");
  // r2 row pointing at the local bucket name
  assertEquals(reason(row({ storage_bucket: "local-bucket", r2_bucket: "local-bucket" })), "BUCKET_MISMATCH");
  assertEquals(reason(row({ storage_bucket: null, r2_bucket: null })), "BUCKET_MISSING");
  assertEquals(reason(row({ storage_bucket: "r2-bucket", r2_bucket: "other-bucket" })), "BUCKET_INCONSISTENT");
});

Deno.test("wrong, missing or unconfigured provider is refused", () => {
  assertEquals(reason(row({ storage_provider: "s3" })), "PROVIDER_UNKNOWN");
  assertEquals(reason(row({ storage_provider: "R2" })), "PROVIDER_UNKNOWN");
  assertEquals(reason(row({ storage_provider: "" })), "PROVIDER_UNKNOWN");
  // A null provider is never defaulted to the currently configured one
  assertEquals(reason(row({ storage_provider: null })), "PROVIDER_UNKNOWN");
  assertEquals(reason(row({ storage_provider: undefined })), "PROVIDER_UNKNOWN");
  // Provider known but not configured on this server
  assertEquals(reason(row(), { local_s3: "local-bucket" }), "PROVIDER_NOT_CONFIGURED");
  assertEquals(reason(row(), { r2: "" }), "PROVIDER_NOT_CONFIGURED");
});

Deno.test("old local_s3 files are not redirected to r2", () => {
  const localRow = row({ storage_provider: "local_s3", storage_bucket: "local-bucket", r2_bucket: "local-bucket" });
  const result = resolveTrustedStorageObject(localRow, BUCKETS);
  assertEquals(result.ok && result.object.provider, "local_s3");
  // Same row with a bucket that only exists for r2 fails instead of being redirected
  assertEquals(reason({ ...localRow, storage_bucket: "r2-bucket", r2_bucket: "r2-bucket" }), "BUCKET_MISMATCH");
  // local_s3 not configured: fails closed, does not fall back to r2
  assertEquals(reason(localRow, { r2: "r2-bucket" }), "PROVIDER_NOT_CONFIGURED");
});

Deno.test("missing or inconsistent keys fail closed", () => {
  assertEquals(reason(row({ storage_key: null, r2_key: null })), "KEY_MISSING");
  assertEquals(reason(row({ storage_key: "", r2_key: "" })), "KEY_MISSING");
  const other = `${expectedKeyPrefix(IDS)}outro.pdf`;
  assertEquals(reason(row({ storage_key: VALID_KEY, r2_key: other })), "KEY_INCONSISTENT");
});

Deno.test("malformed identifiers are refused", () => {
  assertEquals(reason(row({ tenant_id: "not-a-uuid" })), "INVALID_IDENTITY");
  assertEquals(reason(row({ id: "../x" })), "INVALID_IDENTITY");
  assertEquals(reason(row({ document_id: "" })), "INVALID_IDENTITY");
  assertEquals(reason(row({ project_id: PROJECT_A.toUpperCase() })), "INVALID_IDENTITY");
});

Deno.test("buildObjectKey output always passes validation, and bad names are refused", () => {
  const key = buildObjectKey(IDS, "contrato.pdf");
  assertEquals(key, VALID_KEY);
  assertEquals(validateObjectKey(key!, IDS), null);

  for (const name of ["", ".", "..", "a/b", "a\\b", "x\u0000y", "a".repeat(1100)]) {
    assertEquals(buildObjectKey(IDS, name), null, JSON.stringify(name));
  }
  assertEquals(buildObjectKey({ ...IDS, tenant_id: "x" }, "a.pdf"), null);
});
