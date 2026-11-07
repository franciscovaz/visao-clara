import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { presignGetObject } from "../_shared/r2_signer.ts";
import { requireUser } from "../_shared/auth.ts";
import { getConfiguredBuckets, getStorageConfig } from "../_shared/storage.ts";
import { resolveTrustedStorageObject } from "../_shared/storage_identity.ts";
import { fileBelongsToDocument, isUuid } from "../_shared/document_guards.ts";
import { jsonError } from "../_shared/http.ts";
import { createServiceSupabaseClient } from "../_shared/supabase.ts";

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
    if (!isUuid(documentFileId)) {
      return jsonError("document_file_id é obrigatório");
    }

    // Check current status first
    const { data: existingFile, error: fetchError } = await supabase
      .from("document_files")
      .select("id, tenant_id, project_id, document_id, status, storage_provider, storage_bucket, storage_key, r2_bucket, r2_key")
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

    // A deleted file never comes back; pending and failed (late upload) can be confirmed
    if (existingFile.status !== "pending" && existingFile.status !== "failed") {
      return jsonError("Ficheiro já não está disponível", 409);
    }

    // The row must belong to a document the user can read (RLS) with the same tenant/project
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, tenant_id, project_id")
      .eq("id", existingFile.document_id)
      .maybeSingle();

    if (docError) {
      console.error("r2-confirm-upload: fetch document error", docError);
      return jsonError("Erro ao confirmar upload", 500);
    }
    if (!fileBelongsToDocument(existingFile, doc)) {
      console.error("r2-confirm-upload: document mismatch", { document_file_id: existingFile.id });
      return jsonError("Ficheiro não encontrado", 404);
    }

    // Storage coordinates in the row are never trusted as-is (see storage_identity.ts)
    const resolved = resolveTrustedStorageObject(existingFile, getConfiguredBuckets());
    if (!resolved.ok) {
      if (resolved.reason === "KEY_MISSING") {
        return jsonError("Ficheiro ainda não está disponível", 409);
      }
      console.error("r2-confirm-upload: untrusted storage location", {
        document_file_id: existingFile.id,
        reason: resolved.reason,
      });
      return jsonError(
        "Não é possível confirmar este ficheiro em segurança. Contacte o suporte.",
        409,
        { code: "STORAGE_LOCATION_UNTRUSTED" },
      );
    }
    const { provider, bucket, key } = resolved.object;

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
        const response = await fetch(verifyUrl, { method: "GET", signal: AbortSignal.timeout(10_000) });
        await response.body?.cancel();
        if (!response.ok) {
          throw new Error(`Object not found: ${response.status}`);
        }
      } catch (error) {
        console.error("Storage verification error:", error);
        return jsonError("Ficheiro ainda não está disponível", 409);
      }
    }

    // Marking a file as uploaded is server-only: clients cannot write document_files state.
    // The user's access to this row was verified above through their own RLS-scoped client.
    const serviceClient = createServiceSupabaseClient();
    const { data: updatedRows, error: updateError } = await serviceClient
      .from("document_files")
      .update({ status: "uploaded", uploaded_at: new Date().toISOString() })
      .eq("id", existingFile.id)
      .in("status", ["pending", "failed"])
      .select("id");

    if (updateError) {
      console.error("Confirm upload error:", updateError);
      return new Response(
        JSON.stringify({ ok: false, error: "Erro ao confirmar upload" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Lost a race with another status change (e.g. the document was just deleted)
    if (!updatedRows || updatedRows.length === 0) {
      return jsonError("Ficheiro já não está disponível", 409);
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
