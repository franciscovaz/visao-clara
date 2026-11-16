import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { discardObject, readPrefix, verifyStoredUpload } from "./upload_verify.ts";
import type { StorageClient } from "./storage_server.ts";

const REC = { sizeBytes: 12, mimeType: "application/pdf" };
const PDF = new TextEncoder().encode("%PDF-1.7\nabcd"); // 13 bytes, but tests use sizeBytes 12 only where noted

function headResponse(length: number | null, type: string | null, status = 200) {
  const headers = new Headers();
  if (length !== null) headers.set("content-length", String(length));
  if (type) headers.set("content-type", type);
  headers.set("etag", '"abc"');
  return new Response(null, { status, headers });
}

function client(over: Partial<StorageClient>): StorageClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    head: over.head ?? (() => { calls.push("head"); return Promise.resolve(headResponse(12, "application/pdf")); }),
    getRange: over.getRange ?? ((range, ifMatch) => { calls.push(`get:${range}:${ifMatch}`); return Promise.resolve(new Response(PDF.slice(0, 12), { status: 206 })); }),
    delete: over.delete ?? (() => { calls.push("delete"); return Promise.resolve(true); }),
  };
}

Deno.test("a matching object with a valid signature is accepted, using the ETag for the ranged read", async () => {
  const c = client({});
  assertEquals(await verifyStoredUpload(c, REC), { kind: "valid" });
  assertEquals(c.calls.at(-1), 'get:bytes=0-127:"abc"');
});

Deno.test("missing object keeps the file pending", async () => {
  const c = client({ head: () => Promise.resolve(headResponse(null, null, 404)) });
  assertEquals(await verifyStoredUpload(c, REC), { kind: "missing" });
});

Deno.test("size, type and empty mismatches are invalid and the content is never read", async () => {
  const cases: Array<[number, string, number, string]> = [
    // [stored length, stored type, recorded size, expected reason]
    [13, "application/pdf", 12, "SIZE_MISMATCH"],
    [11, "application/pdf", 12, "SIZE_MISMATCH"],
    [12, "image/png", 12, "TYPE_MISMATCH"],
    [0, "application/pdf", 12, "EMPTY"],
    [21 * 1024 * 1024, "application/pdf", 21 * 1024 * 1024, "TOO_LARGE"],
  ];
  for (const [len, type, size, reason] of cases) {
    const c = client({ head: () => Promise.resolve(headResponse(len, type)) });
    assertEquals(await verifyStoredUpload(c, { sizeBytes: size, mimeType: "application/pdf" }), { kind: "invalid", reason });
    assertEquals(c.calls.some((x) => x.startsWith("get")), false, reason);
  }
});

Deno.test("wrong file content is invalid even if size and type match", async () => {
  const c = client({ getRange: () => Promise.resolve(new Response(new TextEncoder().encode("<html>12345"), { status: 206 })) });
  assertEquals(await verifyStoredUpload(c, REC), { kind: "invalid", reason: "SIGNATURE_MISMATCH" });
});

Deno.test("storage errors and a replaced object are never treated as valid or invalid", async () => {
  assertEquals((await verifyStoredUpload(client({ head: () => Promise.resolve(headResponse(null, null, 500)) }), REC)).kind, "unavailable");
  assertEquals((await verifyStoredUpload(client({ head: () => Promise.reject(new Error("net")) }), REC)).kind, "unavailable");
  assertEquals(await verifyStoredUpload(client({ getRange: () => Promise.resolve(new Response(null, { status: 412 })) }), REC), { kind: "unavailable", reason: "OBJECT_CHANGED" });
  assertEquals((await verifyStoredUpload(client({ getRange: () => Promise.resolve(new Response(null, { status: 503 })) }), REC)).kind, "unavailable");
  assertEquals((await verifyStoredUpload(client({ getRange: () => Promise.reject(new Error("net")) }), REC)).kind, "unavailable");
  assertEquals((await verifyStoredUpload(client({ getRange: () => Promise.resolve(new Response(null, { status: 404 })) }), REC)).kind, "missing");
});

Deno.test("a server that ignores Range cannot make us read the whole object", async () => {
  const big = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(64 * 1024).fill(0x25)); },
    cancel() { cancelled = true; },
  });
  let cancelled = false;
  const prefix = await readPrefix(new Response(big, { status: 200 }), 128);
  assertEquals(prefix.length, 128);
  assertEquals(cancelled, true);
});

Deno.test("discardObject reports deletion failures without throwing", async () => {
  assertEquals(await discardObject(client({ delete: () => Promise.resolve(false) })), false);
  assertEquals(await discardObject(client({ delete: () => Promise.reject(new Error("boom")) })), false);
  assertEquals(await discardObject(client({})), true);
});
