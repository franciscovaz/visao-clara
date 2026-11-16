// Server-side requests to object storage (HEAD, ranged GET, DELETE) for a TRUSTED object
// (see storage_identity.ts). Used by r2-confirm-upload, cleanup-pending-uploads and
// delete-document so the local-vs-R2 connection details live in one place.
import { presignDeleteObject, presignGetObject, presignHeadObject } from "./r2_signer.ts";
import { getStorageConfig } from "./storage.ts";
import type { TrustedStorageObject } from "./storage_identity.ts";

const PRESIGN_EXPIRES_SECONDS = 60;
const STORAGE_TIMEOUT_MS = 10_000;

/** Operations upload verification and cleanup need; injectable so they can be unit-tested. */
export interface StorageClient {
  head(): Promise<Response>;
  /** Ranged GET; ifMatch (an ETag) makes storage answer 412 if the object changed meanwhile */
  getRange(range: string, ifMatch?: string | null): Promise<Response>;
  /** Returns true when the object is gone (deleted or already missing) */
  delete(): Promise<boolean>;
}

/**
 * Extracts only <Code> and <Message> from an S3 XML error body (or a JSON
 * error), so logs never include the canonical request, string-to-sign or URL.
 */
export async function readS3Error(response: Response): Promise<{ s3_code?: string; s3_message?: string }> {
  try {
    const text = (await response.text()).slice(0, 4096);
    const xmlCode = text.match(/<Code>([^<]*)<\/Code>/)?.[1];
    const xmlMessage = text.match(/<Message>([^<]*)<\/Message>/)?.[1];
    if (xmlCode || xmlMessage) {
      return { s3_code: xmlCode, s3_message: xmlMessage?.slice(0, 300) };
    }
    const json = JSON.parse(text);
    const code = json?.code ?? json?.error ?? json?.statusCode;
    const message = json?.message ?? json?.msg;
    return {
      s3_code: code !== undefined ? String(code).slice(0, 100) : undefined,
      s3_message: typeof message === "string" ? message.slice(0, 300) : undefined,
    };
  } catch {
    return {};
  }
}

export function createStorageClient(object: TrustedStorageObject): StorageClient {
  const storageConfig = getStorageConfig(object.provider);

  // Server-side request: connect through the internal endpoint, but sign for the
  // host Storage verifies against. Local Kong (KONG_PORT_MAPS) forwards
  // X-Forwarded-Host = internal hostname and X-Forwarded-Port = public port, and
  // Storage rebuilds the SigV4 host from those two headers. For R2 both
  // endpoints are identical, so signing and request URLs are the same.
  const requestEndpoint = new URL(storageConfig.internalEndpoint);
  const signingEndpoint = new URL(storageConfig.internalEndpoint);
  signingEndpoint.port = new URL(storageConfig.endpoint).port;

  const signingOptions = {
    endpoint: signingEndpoint.toString(),
    bucket: object.bucket,
    key: object.key,
    accessKeyId: storageConfig.accessKeyId,
    secretAccessKey: storageConfig.secretAccessKey,
    expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
  };

  const toRequestUrl = (signed: string) => {
    const url = new URL(signed);
    // Only the connection target changes; the signed path and query are untouched
    url.protocol = requestEndpoint.protocol;
    url.host = requestEndpoint.host;
    return url;
  };

  return {
    async head() {
      const url = toRequestUrl(await presignHeadObject(signingOptions));
      return await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS) });
    },

    async getRange(range, ifMatch) {
      const url = toRequestUrl(await presignGetObject(signingOptions));
      // Range and If-Match are not signed: storage accepts them as plain request headers
      const headers: Record<string, string> = { Range: range };
      if (ifMatch) headers["If-Match"] = ifMatch;
      return await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS) });
    },

    async delete() {
      try {
        const url = toRequestUrl(await presignDeleteObject(signingOptions));
        const response = await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS) });
        // S3/R2 answer 204 for deleted and missing keys; accept 404 as already gone
        if (response.ok || response.status === 404) {
          await response.body?.cancel();
          return true;
        }
        console.error("storage delete failed", {
          document_file_id: object.fileId,
          status: response.status,
          ...(await readS3Error(response)),
        });
        return false;
      } catch (err) {
        console.error("storage delete error", { document_file_id: object.fileId, err });
        return false;
      }
    },
  };
}
