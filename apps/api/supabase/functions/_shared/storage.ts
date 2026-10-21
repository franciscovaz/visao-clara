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
    
    if (!accountId) throw new Error("Missing env: VC_R2_ACCOUNT_ID");
    if (!accessKeyId) throw new Error("Missing env: VC_R2_ACCESS_KEY_ID");
    if (!secretAccessKey) throw new Error("Missing env: VC_R2_SECRET_ACCESS_KEY");
    
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

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

export function resolveStoredObject(row: {
  storage_provider?: string | null;
  storage_bucket?: string | null;
  storage_key?: string | null;
  r2_bucket?: string | null;
  r2_key?: string | null;
}) {
  const provider = row.storage_provider ?? getStorageProvider();
  const bucket = row.storage_bucket ?? row.r2_bucket ?? null;
  const key = row.storage_key ?? row.r2_key ?? null;
  
  return { provider, bucket, key };
}
