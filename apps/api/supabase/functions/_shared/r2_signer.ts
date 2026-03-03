// AWS Signature V4 helper for S3-compatible presigned URLs (R2 or Local S3)
// Uses Deno crypto.subtle for HMAC SHA256

const ALGORITHM = { name: "HMAC", hash: "SHA-256" };

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function hmacSha256(key: Uint8Array | ArrayBuffer, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, ALGORITHM, false, ["sign"]);
  const signature = await crypto.subtle.sign(ALGORITHM, cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

async function sha256(message: string): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return new Uint8Array(hash);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function getAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
}

// RFC3986 encode for AWS SigV4 canonical query string
function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildCanonicalQueryString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${awsEncode(k)}=${awsEncode(params[k])}`)
    .join("&");
}

interface PresignPutOptions {
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  contentType?: string; // accepted but NOT signed (insomnia-friendly)
}

interface PresignGetOptions {
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
}

/**
 * Generate a presigned PUT URL for S3-compatible storage (R2 or Local S3)
 */
export async function presignPutObject(options: PresignPutOptions): Promise<string> {
  const { endpoint, bucket, key, accessKeyId, secretAccessKey, expiresInSeconds } = options;

  // Validate endpoint is not a placeholder
  if (!endpoint) {
    throw new Error("Missing endpoint parameter");
  }
  if (endpoint.includes("<account_id>") || endpoint.includes("<")) {
    throw new Error("Endpoint contains placeholder <account_id>; set a real VC_R2_ACCOUNT_ID value");
  }

  const now = new Date();
  const dateStamp = getDateStamp(now);
  const amzDate = getAmzDate(now);

  // Determine region based on provider
  let region = "auto";
  try {
    const provider = (Deno.env.get("FILE_STORAGE_PROVIDER") ?? "").toLowerCase();
    if (provider === "local_s3") {
      region = getEnv("S3_REGION");
    } else if (provider === "r2") {
      region = Deno.env.get("VC_R2_REGION") || "auto";
    }
  } catch {
    region = "auto";
  }

  const service = "s3";

  // Parse endpoint to extract origin and base path
  const endpointUrl = new URL(endpoint);
  const origin = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const basePath = endpointUrl.pathname.replace(/\/$/, ""); // Remove trailing slash

  // Path-style: {basePath}/{bucket}/{key}
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, "/");
  const fullPath = `${basePath}/${bucket}/${encodedKey}`;

  const credential = `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`;

  // IMPORTANT: Canonical query string must be lexicographically sorted
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQueryString = buildCanonicalQueryString(params);

  const host = endpointUrl.host;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";

  const canonicalRequest = [
    "PUT",
    fullPath,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const canonicalRequestHash = toHex(await sha256(canonicalRequest));

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${dateStamp}/${region}/${service}/aws4_request`,
    canonicalRequestHash,
  ].join("\n");

  const dateKey = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, service);
  const signingKey = await hmacSha256(serviceKey, "aws4_request");
  const signature = await hmacSha256(signingKey, stringToSign);

  params["X-Amz-Signature"] = toHex(signature);

  // Return URL with origin and full path
  return `${origin}${fullPath}?${buildCanonicalQueryString(params)}`;
}

/**
 * Generate a presigned GET URL for S3-compatible storage (R2 or Local S3)
 */
export async function presignGetObject(options: PresignGetOptions): Promise<string> {
  const { endpoint, bucket, key, accessKeyId, secretAccessKey, expiresInSeconds } = options;

  // Validate endpoint is not a placeholder
  if (!endpoint) {
    throw new Error("Missing endpoint parameter");
  }
  if (endpoint.includes("<account_id>") || endpoint.includes("<")) {
    throw new Error("Endpoint contains placeholder <account_id>; set a real VC_R2_ACCOUNT_ID value");
  }

  const now = new Date();
  const dateStamp = getDateStamp(now);
  const amzDate = getAmzDate(now);

  // Determine region based on provider
  let region = "auto";
  try {
    const provider = (Deno.env.get("FILE_STORAGE_PROVIDER") ?? "").toLowerCase();
    if (provider === "local_s3") {
      region = getEnv("S3_REGION");
    } else if (provider === "r2") {
      region = Deno.env.get("VC_R2_REGION") || "auto";
    }
  } catch {
    region = "auto";
  }

  const service = "s3";

  // Parse endpoint to extract origin and base path
  const endpointUrl = new URL(endpoint);
  const origin = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const basePath = endpointUrl.pathname.replace(/\/$/, ""); // Remove trailing slash

  // Path-style: {basePath}/{bucket}/{key}
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, "/");
  const fullPath = `${basePath}/${bucket}/${encodedKey}`;

  const credential = `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`;

  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQueryString = buildCanonicalQueryString(params);

  const host = endpointUrl.host;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";

  const canonicalRequest = [
    "GET",
    fullPath,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const canonicalRequestHash = toHex(await sha256(canonicalRequest));

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${dateStamp}/${region}/${service}/aws4_request`,
    canonicalRequestHash,
  ].join("\n");

  const dateKey = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, service);
  const signingKey = await hmacSha256(serviceKey, "aws4_request");
  const signature = await hmacSha256(signingKey, stringToSign);

  params["X-Amz-Signature"] = toHex(signature);

  return `${origin}${fullPath}?${buildCanonicalQueryString(params)}`;
}