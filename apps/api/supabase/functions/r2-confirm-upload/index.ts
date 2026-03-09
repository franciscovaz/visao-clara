import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { presignGetObject } from "../_shared/r2_signer.ts";
import { requireUser } from "../_shared/auth.ts";

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
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

    // Check current status first
    const { data: existingFile, error: fetchError } = await supabase
      .from("document_files")
      .select("id, status, storage_provider, storage_bucket, storage_key, r2_bucket, r2_key")
      .eq("id", documentFileId)
      .single();

    if (fetchError || !existingFile) {
      console.error("Fetch document_file error:", fetchError);
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Idempotent: if already uploaded, return success
    if (existingFile.status === "uploaded") {
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract bucket and key with fallback
    const bucket = existingFile.storage_bucket ?? existingFile.r2_bucket;
    const key = existingFile.storage_key ?? existingFile.r2_key;
    const provider = existingFile.storage_provider ?? (Deno.env.get("FILE_STORAGE_PROVIDER") ?? "local_s3").toLowerCase();

    if (!bucket || !key) {
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro ainda não está disponível" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify object exists in storage before updating status
    let endpoint: string;
    let accessKeyId: string;
    let secretAccessKey: string;

    if (provider === "local_s3") {
      endpoint = getEnv("S3_ENDPOINT_URL");
      accessKeyId = getEnv("S3_ACCESS_KEY_ID");
      secretAccessKey = getEnv("S3_SECRET_ACCESS_KEY");
    } else {
      const r2AccountId = getEnv("VC_R2_ACCOUNT_ID");
      accessKeyId = getEnv("VC_R2_ACCESS_KEY_ID");
      secretAccessKey = getEnv("VC_R2_SECRET_ACCESS_KEY");
      endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;
    }

    // Generate presigned URL for verification
    const verifyUrl = await presignGetObject({
      endpoint,
      bucket,
      key,
      accessKeyId,
      secretAccessKey,
      expiresInSeconds: 60,
    });

    // Verify object exists
    let response;
    try {
      // Try HEAD first
      response = await fetch(verifyUrl, { method: "HEAD" });
      if (!response.ok) {
        // If HEAD fails, try GET
        response = await fetch(verifyUrl, { method: "GET" });
        if (!response.ok) {
          throw new Error(`Object not found: ${response.status}`);
        }
      }
    } catch (error) {
      console.error("Storage verification error:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro ainda não está disponível" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update document_files status to uploaded
    const updateData: any = { status: "uploaded" };
    updateData.uploaded_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("document_files")
      .update(updateData)
      .eq("id", documentFileId);

    if (updateError) {
      console.error("Confirm upload error:", updateError);
      return new Response(
        JSON.stringify({ ok: false, error: "Erro ao confirmar upload" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("r2-confirm-upload error:", err);
    if (err instanceof Response) {
      return err;
    }
    return new Response(
      JSON.stringify({ ok: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
