// Resolves the Cloudflare R2 S3 API endpoint. No Deno or network dependencies, so it is unit-testable.
//
// Standard buckets:        https://<account_id>.r2.cloudflarestorage.com
// EU jurisdiction buckets: https://<account_id>.eu.r2.cloudflarestorage.com
// FedRAMP buckets:         https://<account_id>.fedramp.r2.cloudflarestorage.com

const R2_HOST_RE = /^[a-z0-9]+(\.(eu|fedramp))?\.r2\.cloudflarestorage\.com$/;

/**
 * Validates an explicit VC_R2_ENDPOINT and returns it normalised to its origin
 * (no trailing slash). The host is restricted to Cloudflare's R2 domain because
 * presigned URLs are handed to browsers and fetched server-side by delete-document.
 */
export function parseR2Endpoint(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Invalid VC_R2_ENDPOINT: not a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Invalid VC_R2_ENDPOINT: must use https");
  }
  if (url.username || url.password) {
    throw new Error("Invalid VC_R2_ENDPOINT: must not contain credentials");
  }
  if (url.port) {
    throw new Error("Invalid VC_R2_ENDPOINT: must not specify a port");
  }
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
    throw new Error("Invalid VC_R2_ENDPOINT: must not contain a path, query or fragment");
  }
  if (!R2_HOST_RE.test(url.hostname)) {
    throw new Error(
      "Invalid VC_R2_ENDPOINT: host must be <account_id>[.eu|.fedramp].r2.cloudflarestorage.com",
    );
  }

  return url.origin;
}

/**
 * VC_R2_ENDPOINT wins when set; otherwise the standard endpoint is derived from
 * VC_R2_ACCOUNT_ID (the behaviour before VC_R2_ENDPOINT existed).
 */
export function resolveR2Endpoint(accountId?: string, endpoint?: string): string {
  if (endpoint && endpoint.trim()) {
    return parseR2Endpoint(endpoint);
  }
  if (!accountId) throw new Error("Missing env: VC_R2_ACCOUNT_ID");
  return `https://${accountId}.r2.cloudflarestorage.com`;
}
