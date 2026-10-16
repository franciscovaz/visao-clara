import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  EXPORT_JWT_SECRET: string;
  STORAGE_PROVIDER: string;
  R2_BUCKET?: R2Bucket;
  S3_ENDPOINT_URL?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
}

export interface StorageBackend {
  head(key: string): Promise<boolean>;
  get(key: string): Promise<ReadableStream<Uint8Array>>;
}

export class R2Storage implements StorageBackend {
  constructor(private bucket: R2Bucket) {}

  async head(key: string): Promise<boolean> {
    try {
      const object = await this.bucket.head(key);
      return object !== null;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const object = await this.bucket.get(key);
    if (!object) {
      throw new Error(`Object not found: ${key}`);
    }
    if (!object.body) {
      throw new Error(`Object has no body: ${key}`);
    }
    return object.body;
  }
}

export class S3Storage implements StorageBackend {
  private client: S3Client;
  private bucket: string;

  constructor(endpoint: string, accessKeyId: string, secretAccessKey: string, region: string, bucket: string) {
    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
    this.bucket = bucket;
  }

  async head(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && "name" in error && error.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error(`Object has no body: ${key}`);
    }

    return response.Body.transformToByteArray() as unknown as ReadableStream<Uint8Array>;
  }
}

export function createStorageBackend(env: Env): StorageBackend {
  const storageProvider = env.STORAGE_PROVIDER || "r2";

  if (storageProvider === "r2") {
    if (!env.R2_BUCKET) {
      throw new Error("R2_BUCKET binding not configured");
    }
    return new R2Storage(env.R2_BUCKET);
  }

  if (storageProvider === "s3") {
    if (!env.S3_ENDPOINT_URL || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET) {
      throw new Error("S3 environment variables not configured");
    }
    return new S3Storage(
      env.S3_ENDPOINT_URL,
      env.S3_ACCESS_KEY_ID,
      env.S3_SECRET_ACCESS_KEY,
      env.S3_REGION || "us-east-1",
      env.S3_BUCKET
    );
  }

  throw new Error(`Unsupported storage provider: ${storageProvider}`);
}
