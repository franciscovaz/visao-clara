import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { presignGetObject } from "../_shared/r2_signer.ts";
import { requireUser } from "../_shared/auth.ts";

const EXPIRES_IN_SECONDS = 600;

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function getProviderEnv(varName: string): string {
  const provider = Deno.env.get("FILE_STORAGE_PROVIDER") || "local_s3";
  
  if (provider === "local_s3") {
    const s3Var = Deno.env.get(`S3_${varName}`);
    if (!s3Var) throw new Error(`Missing env: S3_${varName}`);
    return s3Var;
  } else if (provider === "r2") {
    const r2Var = Deno.env.get(`VC_R2_${varName}`);
    if (!r2Var) throw new Error(`Missing env: VC_R2_${varName}`);
    return r2Var;
  } else {
    throw new Error(`Unsupported FILE_STORAGE_PROVIDER: ${provider}`);
  }
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-jwt, apikey",
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders() 
    });
  }

  try {
    // Validate auth using requireUser
    const auth = await requireUser(req);
    const { userId, token } = auth;

    // Create Supabase client with user token for RLS
    const supabaseUrl = getEnv("VC_SUPABASE_URL");
    const supabaseAnonKey = getEnv("VC_SUPABASE_ANON_KEY");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Corpo da requisição inválido" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const documentFileId = body.document_file_id as string;
    if (!documentFileId) {
      return new Response(
        JSON.stringify({ ok: false, error: "document_file_id é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch document_files row (RLS ensures access)
    const { data: documentFile, error: fetchError } = await supabase
      .from("document_files")
      .select("storage_provider, storage_bucket, storage_key, r2_bucket, r2_key, status")
      .eq("id", documentFileId)
      .single();

    if (fetchError || !documentFile) {
      console.error("Fetch document file error:", fetchError);
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract bucket and key with fallback
    const storageBucket = documentFile.storage_bucket ?? documentFile.r2_bucket;
    const storageKey = documentFile.storage_key ?? documentFile.r2_key;
    const storageProvider = documentFile.storage_provider ?? (Deno.env.get("FILE_STORAGE_PROVIDER") ?? "local_s3").toLowerCase();

    // Validate before signing
    if (documentFile.status !== "uploaded") {
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro ainda não está disponível" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!storageKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro ainda não está disponível" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!storageBucket) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing bucket" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate presigned GET URL
    let endpoint, accessKeyId, secretAccessKey;
    
    if (storageProvider === "local_s3") {
      endpoint = getProviderEnv("ENDPOINT_URL");
      accessKeyId = getProviderEnv("ACCESS_KEY_ID");
      secretAccessKey = getProviderEnv("SECRET_ACCESS_KEY");
      getProviderEnv("REGION");
    } else if (storageProvider === "r2") {
      const r2AccountId = getProviderEnv("ACCOUNT_ID");
      accessKeyId = getProviderEnv("ACCESS_KEY_ID");
      secretAccessKey = getProviderEnv("SECRET_ACCESS_KEY");
      endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;
      getProviderEnv("REGION");
    } else {
      throw new Error(`Unsupported FILE_STORAGE_PROVIDER: ${storageProvider}`);
    }

    const downloadUrl = await presignGetObject({
      endpoint,
      bucket: storageBucket,
      key: storageKey,
      accessKeyId,
      secretAccessKey,
      expiresInSeconds: EXPIRES_IN_SECONDS,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        download: {
          url: downloadUrl,
          expires_in: EXPIRES_IN_SECONDS,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("r2-sign-download error:", err);
    if (err instanceof Response) {
      return err;
    }
    return new Response(
      JSON.stringify({ ok: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
