import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { presignPutObject } from "../_shared/r2_signer.ts";
import { getUserOrThrow } from "../_shared/auth.ts";

const EXPIRES_IN_SECONDS = 900;

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/\\/g, "-")
    .replace(/\//g, "-")
    .replace(/\\/g, "-")
    .replace(/\s+/g, "-");
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

serve(async (req) => {
  try {
    // Validate auth using shared helper
    const authResult = await getUserOrThrow(req);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, supabase } = authResult;
    const userId = user.id;

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

    const tenantId = body.tenant_id as string;
    const projectId = body.project_id as string;
    const documentInput = body.document as Record<string, unknown> | undefined;
    const fileInput = body.file as Record<string, unknown> | undefined;

    if (!tenantId || !projectId || !documentInput || !fileInput) {
      return new Response(
        JSON.stringify({ ok: false, error: "Campos obrigatórios em falta" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate file fields
    const fileName = String(fileInput.file_name || "").trim();
    const mimeType = String(fileInput.mime_type || "").trim();
    const sizeBytes = Number(fileInput.size_bytes);

    if (!fileName || !mimeType || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Dados do ficheiro inválidos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create document row
    const { data: document, error: docError } = await supabase
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

    if (docError || !document) {
      console.error("Document insert error:", docError);
      return new Response(
        JSON.stringify({ ok: false, error: "Erro ao criar documento" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate r2_key
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
        r2_bucket: getEnv("R2_BUCKET"),
        r2_key: null,
        created_by: userId,
      })
      .select("id, tenant_id, project_id, document_id, file_name, mime_type, size_bytes, status, r2_bucket, r2_key, created_at")
      .single();

    if (fileError || !documentFile) {
      console.error("Document file insert error:", fileError);
      return new Response(
        JSON.stringify({ ok: false, error: "Erro ao criar registo de ficheiro" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate r2_key with the document_file_id
    const r2Key = `${tenantId}/${projectId}/${document.id}/${documentFile.id}/${sanitizedFileName}`;

    // Update document_file with r2_key
    const { error: updateError } = await supabase
      .from("document_files")
      .update({ r2_key: r2Key })
      .eq("id", documentFile.id);

    if (updateError) {
      console.error("Update r2_key error:", updateError);
      return new Response(
        JSON.stringify({ ok: false, error: "Erro ao atualizar chave R2" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate presigned PUT URL
    const r2Endpoint = getEnv("R2_ENDPOINT");
    const r2Bucket = getEnv("R2_BUCKET");
    const r2AccessKeyId = getEnv("R2_ACCESS_KEY_ID");
    const r2SecretAccessKey = getEnv("R2_SECRET_ACCESS_KEY");

    const uploadUrl = await presignPutObject({
      endpoint: r2Endpoint,
      bucket: r2Bucket,
      key: r2Key,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      expiresInSeconds: EXPIRES_IN_SECONDS,
      contentType: mimeType,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        document,
        document_file: {
          ...documentFile,
          r2_key: r2Key,
        },
        upload: {
          url: uploadUrl,
          expires_in: EXPIRES_IN_SECONDS,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("r2-sign-upload error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
