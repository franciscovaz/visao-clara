// AWS Signature V4 helper for S3-compatible presigned URLs (R2)
// Uses Deno crypto.subtle for HMAC SHA256

const ALGORITHM = { name: "HMAC", hash: "SHA-256" };

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

interface PresignPutOptions {
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  contentType?: string;
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
 * Generate a presigned PUT URL for S3-compatible storage (R2)
 */
export async function presignPutObject(options: PresignPutOptions): Promise<string> {
  const { endpoint, bucket, key, accessKeyId, secretAccessKey, expiresInSeconds, contentType } = options;

  const now = new Date();
  const dateStamp = getDateStamp(now);
  const amzDate = getAmzDate(now);
  const region = "auto";
  const service = "s3";

  const encodedKey = encodeURIComponent(key).replace(/%2F/g, "/");
  const urlPath = `/${bucket}/${encodedKey}`;

  const credential = `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`;

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  });

  if (contentType) {
    queryParams.set("X-Amz-SignedHeaders", "host;content-type");
  }

  const canonicalHeaders = contentType
    ? `host:${new URL(endpoint).host}\ncontent-type:${contentType}\n`
    : `host:${new URL(endpoint).host}\n`;

  const signedHeaders = contentType ? "host;content-type" : "host";

  const canonicalRequest = [
    "PUT",
    urlPath,
    queryParams.toString(),
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

  const dateKey = await hmacSha256(
    new TextEncoder().encode(`AWS4${secretAccessKey}`),
    dateStamp
  );
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, service);
  const signingKey = await hmacSha256(serviceKey, "aws4_request");
  const signature = await hmacSha256(signingKey, stringToSign);

  queryParams.set("X-Amz-Signature", toHex(signature));

  return `${endpoint}${urlPath}?${queryParams.toString()}`;
}

/**
 * Generate a presigned GET URL for S3-compatible storage (R2)
 */
export async function presignGetObject(options: PresignGetOptions): Promise<string> {
  const { endpoint, bucket, key, accessKeyId, secretAccessKey, expiresInSeconds } = options;

  const now = new Date();
  const dateStamp = getDateStamp(now);
  const amzDate = getAmzDate(now);
  const region = "auto";
  const service = "s3";

  const encodedKey = encodeURIComponent(key).replace(/%2F/g, "/");
  const urlPath = `/${bucket}/${encodedKey}`;

  const credential = `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`;

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  });

  const canonicalHeaders = `host:${new URL(endpoint).host}\n`;
  const signedHeaders = "host";

  const canonicalRequest = [
    "GET",
    urlPath,
    queryParams.toString(),
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

  const dateKey = await hmacSha256(
    new TextEncoder().encode(`AWS4${secretAccessKey}`),
    dateStamp
  );
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, service);
  const signingKey = await hmacSha256(serviceKey, "aws4_request");
  const signature = await hmacSha256(signingKey, stringToSign);

  queryParams.set("X-Amz-Signature", toHex(signature));

  return `${endpoint}${urlPath}?${queryParams.toString()}`;
}
