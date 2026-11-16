// Verification of an uploaded object before it may be marked 'uploaded'.
// The storage client is injected, so every branch can be unit-tested without a network.
import { checkFileSignature, checkStoredObject, SIGNATURE_RANGE_BYTES } from "./upload_policy.ts";
import type { StorageClient } from "./storage_server.ts";

export type VerifyOutcome =
  | { kind: "valid" }
  /** No object yet (the PUT did not happen or has not finished): the file stays pending */
  | { kind: "missing" }
  /** Storage could not answer reliably (error, or the object changed between requests): retry later */
  | { kind: "unavailable"; reason: string }
  /** The stored object does not match the record or its declared type: it must not be served */
  | { kind: "invalid"; reason: string };

/** Reads at most `limit` bytes, then stops the stream (a server ignoring Range could send 20 MB). */
export async function readPrefix(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(Math.min(total, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, out.length - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= out.length) break;
  }
  return out;
}

export async function verifyStoredUpload(
  client: StorageClient,
  record: { sizeBytes: number; mimeType: string },
): Promise<VerifyOutcome> {
  let head: Response;
  try {
    head = await client.head();
  } catch {
    return { kind: "unavailable", reason: "HEAD_FAILED" };
  }
  if (head.status === 404) return { kind: "missing" };
  if (!head.ok) return { kind: "unavailable", reason: `HEAD_${head.status}` };

  const lengthHeader = head.headers.get("content-length");
  const stored = checkStoredObject(
    { contentLength: lengthHeader === null ? null : Number(lengthHeader), contentType: head.headers.get("content-type") },
    record,
  );
  if (!stored.ok) return { kind: "invalid", reason: stored.reason };

  let range: Response;
  try {
    range = await client.getRange(`bytes=0-${SIGNATURE_RANGE_BYTES - 1}`, head.headers.get("etag"));
  } catch {
    return { kind: "unavailable", reason: "GET_FAILED" };
  }
  if (range.status === 404) return { kind: "missing" };
  // 412: the object was replaced after the HEAD. Do not trust either answer.
  if (range.status === 412) return { kind: "unavailable", reason: "OBJECT_CHANGED" };
  if (!range.ok) return { kind: "unavailable", reason: `GET_${range.status}` };

  const bytes = await readPrefix(range, SIGNATURE_RANGE_BYTES);
  const signature = checkFileSignature(record.mimeType, bytes);
  if (!signature.ok) return { kind: "invalid", reason: signature.reason };

  return { kind: "valid" };
}

/** Best-effort removal of an invalid object. Never throws. Returns whether the object is gone. */
export async function discardObject(client: StorageClient): Promise<boolean> {
  try {
    return await client.delete();
  } catch {
    return false;
  }
}
