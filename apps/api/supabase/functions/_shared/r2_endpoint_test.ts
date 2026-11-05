// Run from apps/api/supabase/functions: deno test _shared/r2_endpoint_test.ts
import { assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { parseR2Endpoint, resolveR2Endpoint } from "./r2_endpoint.ts";
import { presignDeleteObject, presignGetObject, presignPutObject } from "./r2_signer.ts";

const STANDARD = "https://abc123.r2.cloudflarestorage.com";
const EU = "https://abc123.eu.r2.cloudflarestorage.com";

Deno.test("falls back to the standard endpoint from the account id", () => {
  assertEquals(resolveR2Endpoint("abc123", undefined), STANDARD);
  assertEquals(resolveR2Endpoint("abc123", ""), STANDARD);
  assertEquals(resolveR2Endpoint("abc123", "   "), STANDARD);
});

Deno.test("uses VC_R2_ENDPOINT when provided, without needing the account id", () => {
  assertEquals(resolveR2Endpoint(undefined, EU), EU);
  assertEquals(resolveR2Endpoint("other", EU), EU);
  assertEquals(resolveR2Endpoint("abc123", STANDARD), STANDARD);
});

Deno.test("normalises trailing slash, case and whitespace", () => {
  assertEquals(parseR2Endpoint(`  ${EU}/ `), EU);
  assertEquals(parseR2Endpoint("HTTPS://ABC123.EU.R2.CLOUDFLARESTORAGE.COM"), EU);
});

Deno.test("accepts the fedramp endpoint", () => {
  assertEquals(
    parseR2Endpoint("https://abc123.fedramp.r2.cloudflarestorage.com"),
    "https://abc123.fedramp.r2.cloudflarestorage.com",
  );
});

Deno.test("requires an account id or endpoint", () => {
  assertThrows(() => resolveR2Endpoint(undefined, undefined), Error, "VC_R2_ACCOUNT_ID");
});

Deno.test("rejects malformed or unsafe endpoints", () => {
  const bad = [
    "not a url",
    "abc123.r2.cloudflarestorage.com",
    "http://abc123.r2.cloudflarestorage.com",
    "https://user:pw@abc123.r2.cloudflarestorage.com",
    "https://abc123.r2.cloudflarestorage.com:8443",
    "https://abc123.r2.cloudflarestorage.com/bucket",
    "https://abc123.r2.cloudflarestorage.com/?x=1",
    "https://abc123.r2.cloudflarestorage.com/#frag",
    "https://evil.example.com",
    "https://abc123.r2.cloudflarestorage.com.evil.example",
    "https://evil.example/.r2.cloudflarestorage.com",
    "https://abc123.us.r2.cloudflarestorage.com",
    "https://.r2.cloudflarestorage.com",
    "https://127.0.0.1:9000",
    "https://<account_id>.eu.r2.cloudflarestorage.com",
  ];
  for (const value of bad) {
    assertThrows(() => parseR2Endpoint(value), Error, "VC_R2_ENDPOINT");
  }
});

Deno.test("presigned PUT/GET/DELETE use the configured endpoint host and path-style bucket", async () => {
  const base = {
    bucket: "docs",
    key: "t/p/d/f/file.pdf",
    accessKeyId: "AKID",
    secretAccessKey: "SECRET",
    expiresInSeconds: 60,
  };

  for (const endpoint of [STANDARD, EU]) {
    const urls = [
      await presignPutObject({ ...base, endpoint }),
      await presignGetObject({ ...base, endpoint }),
      await presignDeleteObject({ ...base, endpoint }),
    ];
    for (const raw of urls) {
      const url = new URL(raw);
      assertEquals(url.origin, endpoint);
      assertEquals(url.pathname, "/docs/t/p/d/f/file.pdf");
      assertEquals(url.searchParams.get("X-Amz-SignedHeaders"), "host");
    }
  }
});

Deno.test("keeps the signer's placeholder guard", async () => {
  await assertRejects(() =>
    presignGetObject({
      endpoint: "https://<account_id>.r2.cloudflarestorage.com",
      bucket: "b",
      key: "k",
      accessKeyId: "a",
      secretAccessKey: "s",
      expiresInSeconds: 60,
    })
  );
});

Deno.test("presigned URL signatures are stable for fixed inputs (SigV4 regression)", async () => {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(value?: number | string | Date) {
      super(value === undefined ? "2026-01-02T03:04:05Z" : value);
    }
  }
  globalThis.Date = FixedDate as DateConstructor;
  try {
    const options = {
      endpoint: EU,
      bucket: "docs",
      key: "t/p/d/f/file.pdf",
      accessKeyId: "AKID",
      secretAccessKey: "SECRET",
      expiresInSeconds: 60,
    };
    const prefix = `${EU}/docs/t/p/d/f/file.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256` +
      "&X-Amz-Credential=AKID%2F20260102%2Fauto%2Fs3%2Faws4_request" +
      "&X-Amz-Date=20260102T030405Z&X-Amz-Expires=60&X-Amz-Signature=";
    // Golden values captured from the implementation before the type-only fix.
    assertEquals(
      await presignPutObject(options),
      `${prefix}c27bbf698fc2e0d4307514a92a4c125e2917c147527ab9f738c6426c0994e222&X-Amz-SignedHeaders=host`,
    );
    assertEquals(
      await presignGetObject(options),
      `${prefix}9cd0a15a9b0d0bce2f93762dacdd44d95b55a9365249064377ba3ab5430cb98f&X-Amz-SignedHeaders=host`,
    );
  } finally {
    globalThis.Date = RealDate;
  }
});
