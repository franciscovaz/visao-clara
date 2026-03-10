import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { presignGetObject } from "../_shared/r2_signer.ts";
import { requireUser } from "../_shared/auth.ts";
import { getStorageConfig, resolveStoredObject } from "../_shared/storage.ts";
import { jsonError } from "../_shared/http.ts";
import { createUserSupabaseClient } from "../_shared/supabase.ts";

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
      return jsonError("document_file_id é obrigatório");
    }

    // Check current status first
    const { data: existingFile, error: fetchError } = await supabase
      .from("document_files")
      .select("id, status, storage_provider, storage_bucket, storage_key, r2_bucket, r2_key")
      .eq("id", documentFileId)
      .single();

    if (fetchError || !existingFile) {
      console.error("Fetch document_file error:", fetchError);
      return jsonError("Ficheiro não encontrado", 404);
    }

    // Idempotent: if already uploaded, return success
    if (existingFile.status === "uploaded") {
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract bucket and key with fallback
    const { provider, bucket, key } = resolveStoredObject(existingFile);

    if (!bucket || !key) {
      return jsonError("Ficheiro ainda não está disponível", 409);
    }

    // Verify object exists in storage before updating status
    const storageConfig = getStorageConfig(provider);

    // Skip remote verification for local_s3, verify only for R2
    if (provider === "r2") {
      // Generate presigned URL for verification
      const verifyUrl = await presignGetObject({
        endpoint: storageConfig.endpoint,
        bucket,
        key,
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
        expiresInSeconds: 60,
      });

      // Verify object exists
      try {
        const response = await fetch(verifyUrl, { method: "GET" });
        if (!response.ok) {
          throw new Error(`Object not found: ${response.status}`);
        }
      } catch (error) {
        console.error("Storage verification error:", error);
        return jsonError("Ficheiro ainda não está disponível", 409);
      }
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
