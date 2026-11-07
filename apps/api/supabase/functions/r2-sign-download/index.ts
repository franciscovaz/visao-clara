import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { presignGetObject } from "../_shared/r2_signer.ts";
import { requireUser } from "../_shared/auth.ts";
import { getConfiguredBuckets, getStorageConfig } from "../_shared/storage.ts";
import { resolveTrustedStorageObject } from "../_shared/storage_identity.ts";
import { fileBelongsToDocument, isUuid } from "../_shared/document_guards.ts";
import { jsonError } from "../_shared/http.ts";

const EXPIRES_IN_SECONDS = 600;

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
      return new Response(
        JSON.stringify({ ok: false, error: "document_file_id é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch document_files row (RLS ensures access)
    const { data: documentFile, error: fetchError } = await supabase
      .from("document_files")
      .select("id, tenant_id, project_id, document_id, storage_provider, storage_bucket, storage_key, r2_bucket, r2_key, status")
      .eq("id", documentFileId)
      .single();

    if (fetchError || !documentFile) {
      console.error("Fetch document file error:", fetchError);
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Only confirmed uploads are served
    if (documentFile.status !== "uploaded") {
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro ainda não está disponível" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // The row must belong to a document the user can read (RLS) with the same tenant/project
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, tenant_id, project_id")
      .eq("id", documentFile.document_id)
      .maybeSingle();

    if (docError) {
      console.error("r2-sign-download: fetch document error", docError);
      return jsonError("Erro interno do servidor", 500);
    }
    if (!fileBelongsToDocument(documentFile, doc)) {
      console.error("r2-sign-download: document mismatch", { document_file_id: documentFile.id });
      return jsonError("Ficheiro não encontrado", 404);
    }

    // Storage coordinates in the row are never trusted as-is: the key must sit under this
    // file's own tenant/project/document/file prefix and the bucket is the configured one
    const resolved = resolveTrustedStorageObject(documentFile, getConfiguredBuckets());
    if (!resolved.ok) {
      console.error("r2-sign-download: untrusted storage location", {
        document_file_id: documentFile.id,
        reason: resolved.reason,
      });
      return jsonError(
        "Não é possível disponibilizar este ficheiro em segurança. Contacte o suporte.",
        409,
        { code: "STORAGE_LOCATION_UNTRUSTED" },
      );
    }
    const { provider, bucket, key } = resolved.object;

    // Credentials and endpoint for the row's own provider (old local_s3 files stay local_s3)
    const storageConfig = getStorageConfig(provider);

    const downloadUrl = await presignGetObject({
      endpoint: storageConfig.endpoint,
      bucket,
      key,
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
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
