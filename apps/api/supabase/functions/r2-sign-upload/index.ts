import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { presignPutObject } from "../_shared/r2_signer.ts";
import { requireUser } from "../_shared/auth.ts";
import { getStorageProvider, getStorageConfig } from "../_shared/storage.ts";
import { jsonError } from "../_shared/http.ts";
import { createUserSupabaseClient } from "../_shared/supabase.ts";

const EXPIRES_IN_SECONDS = 900;

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/\\/g, "-")
    .replace(/\//g, "-")
    .replace(/\\/g, "-")
    .replace(/\s+/g, "-");
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

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
      headers: corsHeaders(),
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

    // Storage configuration
    const provider = getStorageProvider();
    const storageConfig = getStorageConfig(provider);
    const bucketForDb = provider === "local_s3" 
      ? getEnv("S3_BUCKET")
      : getEnv("VC_R2_BUCKET");

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("Corpo da requisição inválido");
    }

    const tenantId = body.tenant_id as string;
    const projectId = body.project_id as string;
    const documentId = body.document_id as string | undefined;
    const documentInput = body.document as Record<string, unknown> | undefined;
    const fileInput = body.file as Record<string, unknown> | undefined;
    const filesInput = body.files as Record<string, unknown>[] | undefined;

    // Normalize files array
    const files = filesInput ?? (fileInput ? [fileInput] : []);

    if (!tenantId || !projectId || !documentInput || !files.length) {
      return jsonError("Campos obrigatórios em falta");
    }

    // Validate each file
    for (const file of files) {
      const fileName = String(file.file_name || "").trim();
      const mimeType = String(file.mime_type || "").trim();
      const sizeBytes = Number(file.size_bytes);

      if (!fileName || !mimeType || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
        return jsonError("Ficheiro inválido", 400, { details: "Dados do ficheiro inválidos" });
      }

      // Validate mime type
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return jsonError("Ficheiro inválido", 400, { details: `Tipo de ficheiro não permitido: ${mimeType}` });
      }

      // Validate file size
      if (sizeBytes > MAX_FILE_SIZE_BYTES) {
        return jsonError("Ficheiro inválido", 400, { details: "Ficheiro excede o tamanho máximo de 20MB" });
      }
    }

    // Get or create document row
    let document;
    if (documentId) {
      // Fetch existing document
      const { data: existingDoc, error: fetchError } = await supabase
        .from("documents")
        .select("id, tenant_id, project_id, title, doc_type, created_at")
        .eq("id", documentId)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .single();

      if (fetchError || !existingDoc) {
        console.error("Document fetch error:", fetchError);
        return new Response(
          JSON.stringify({ ok: false, error: "Documento não encontrado" }),
          {
            status: 404,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }
      document = existingDoc;
    } else {
      // Create new document
      const { data: newDoc, error: docError } = await supabase
        .from("documents")
        .insert({
          tenant_id: tenantId,
          project_id: projectId,
          title: String(documentInput.title || ""),
          description: documentInput.description ? String(documentInput.description) : null,
          doc_type: documentInput.doc_type ? String(documentInput.doc_type) : null,
          category: documentInput.category ? String(documentInput.category) : null,
          tags: Array.isArray(documentInput.tags) ? documentInput.tags.map((t: unknown) => String(t)) : [],
          issued_on: documentInput.issued_on ? String(documentInput.issued_on) : null,
          supplier_name: documentInput.supplier_name ? String(documentInput.supplier_name) : null,
          expense_id: documentInput.expense_id ? String(documentInput.expense_id) : null,
          created_by: userId,
        })
        .select("id, tenant_id, project_id, title, doc_type, created_at")
        .single();

      if (docError || !newDoc) {
        console.error("Document insert error:", docError);
        return new Response(
          JSON.stringify({ ok: false, error: "Erro ao criar documento" }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }
      document = newDoc;
    }

    // Process each file
    const uploads = [];
    for (const file of files) {
      const fileName = String(file.file_name || "").trim();
      const mimeType = String(file.mime_type || "").trim();
      const sizeBytes = Number(file.size_bytes);

      // Generate key parts
      const sanitizedFileName = sanitizeFileName(fileName);

      // Create document_files row with status pending
      const { data: documentFile, error: fileError } = await supabase
        .from("document_files")
        .insert({
          tenant_id: tenantId,
          project_id: projectId,
          document_id: document.id,
          file_name: sanitizedFileName,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          status: "pending",
          r2_bucket: bucketForDb, // Keep for backward compatibility
          r2_key: null,
          storage_provider: provider,
          storage_bucket: bucketForDb,
          storage_key: null,
          created_by: userId,
        })
        .select(
          "id, tenant_id, project_id, document_id, file_name, mime_type, size_bytes, status, r2_bucket, r2_key, storage_provider, storage_bucket, storage_key, created_at",
        )
        .single();

      if (fileError || !documentFile) {
        console.error("Document file insert error:", fileError);
        return new Response(
          JSON.stringify({ ok: false, error: "Erro ao criar registo de ficheiro" }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }

      // Generate key with document_file_id
      const r2Key = `${tenantId}/${projectId}/${document.id}/${documentFile.id}/${sanitizedFileName}`;

      // Update document_file with key
      const { error: updateError } = await supabase
        .from("document_files")
        .update({ r2_key: r2Key, storage_key: r2Key })
        .eq("id", documentFile.id);

      if (updateError) {
        console.error("Update r2_key error:", updateError);
        return new Response(
          JSON.stringify({ ok: false, error: "Erro ao atualizar chave do ficheiro" }),
          {
            status: 500,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          },
        );
      }

      // Generate presigned PUT URL (provider-based)
      const uploadUrl = await presignPutObject({
        endpoint: storageConfig.endpoint,
        bucket: bucketForDb,
        key: r2Key,
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
        expiresInSeconds: EXPIRES_IN_SECONDS,
        contentType: mimeType,
      });

      uploads.push({
        document_file: {
          ...documentFile,
          r2_key: r2Key,
          storage_key: r2Key,
        },
        upload: {
          url: uploadUrl,
          expires_in: EXPIRES_IN_SECONDS,
        },
      });
    }

    // Build response with backward compatibility
    const response: any = {
      ok: true,
      document,
      uploads,
    };

    // Add legacy single file response for backward compatibility
    if (uploads.length === 1) {
      response.document_file = uploads[0].document_file;
      response.upload = uploads[0].upload;
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("r2-sign-upload error:", err);
    if (err instanceof Response) return err;

    return new Response(
      JSON.stringify({ ok: false, error: "Erro interno do servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      },
    );
  }
});