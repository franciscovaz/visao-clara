import { resolveR2Endpoint } from "./r2_endpoint.ts";
import type { ConfiguredBuckets } from "./storage_identity.ts";

export function getStorageProvider(): string {
  return (Deno.env.get("FILE_STORAGE_PROVIDER") ?? "local_s3").toLowerCase();
}

export function getStorageConfig(provider?: string) {
  const providerName = provider ?? getStorageProvider();
  
  if (providerName === "local_s3") {
    const endpoint = Deno.env.get("S3_ENDPOINT_URL");
    const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY");
    const region = Deno.env.get("S3_REGION");
    
    if (!endpoint) throw new Error("Missing env: S3_ENDPOINT_URL");
    if (!accessKeyId) throw new Error("Missing env: S3_ACCESS_KEY_ID");
    if (!secretAccessKey) throw new Error("Missing env: S3_SECRET_ACCESS_KEY");
    
    return {
      provider: "local_s3",
      endpoint,
      // Functions run in Docker, where 127.0.0.1 is not the Supabase gateway:
      // requests made by the function itself go through the internal host
      internalEndpoint: Deno.env.get("S3_INTERNAL_ENDPOINT_URL") ?? endpoint,
      accessKeyId,
      secretAccessKey,
      region,
    };
  }
  
  if (providerName === "r2") {
    const accountId = Deno.env.get("VC_R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("VC_R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("VC_R2_SECRET_ACCESS_KEY");
    const region = Deno.env.get("VC_R2_REGION") ?? "auto";
    
    if (!accessKeyId) throw new Error("Missing env: VC_R2_ACCESS_KEY_ID");
    if (!secretAccessKey) throw new Error("Missing env: VC_R2_SECRET_ACCESS_KEY");

    const endpoint = resolveR2Endpoint(accountId, Deno.env.get("VC_R2_ENDPOINT"));

    return {
      provider: "r2",
      endpoint,
      internalEndpoint: endpoint,
      accessKeyId,
      secretAccessKey,
      region,
    };
  }
  
  throw new Error(`Unsupported storage provider: ${providerName}`);
}

/**
 * Buckets configured on the server for each provider. Document rows are only trusted when
 * their bucket equals the one configured for their own provider (see storage_identity.ts).
 */
export function getConfiguredBuckets(): ConfiguredBuckets {
  return {
    local_s3: Deno.env.get("S3_BUCKET") || undefined,
    r2: Deno.env.get("VC_R2_BUCKET") || undefined,
  };
}
