import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { presignDeleteObject } from "../_shared/r2_signer.ts";
import { requireUser } from "../_shared/auth.ts";
import { getStorageConfig, resolveStoredObject } from "../_shared/storage.ts";
import { jsonError, jsonResponse } from "../_shared/http.ts";
import { createUserSupabaseClient } from "../_shared/supabase.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRESIGN_EXPIRES_SECONDS = 60;
const STORAGE_TIMEOUT_MS = 10_000;

interface DocumentFileRow {
  id: string;
  storage_provider: string | null;
  storage_bucket: string | null;
  storage_key: string | null;
  r2_bucket: string | null;
  r2_key: string | null;
}

interface StoredObject {
  fileId: string;
  provider: string;
  bucket: string;
  key: string;
}

type ResolvedLocation =
  | { kind: "none" }
  | { kind: "untrusted" }
  | { kind: "object"; object: StoredObject };

function configuredBucket(provider: string): string | undefined {
  if (provider === "local_s3") return Deno.env.get("S3_BUCKET");
  if (provider === "r2") return Deno.env.get("VC_R2_BUCKET");
  return undefined;
}

/**
 * Storage coordinates come from the DB row, but are only trusted if they match
 * the key layout r2-sign-upload writes for this document and the bucket
 * configured for the provider (members can edit document_files rows directly).
 */
function resolveLocation(
  file: DocumentFileRow,
  doc: { id: string; tenant_id: string; project_id: string },
): ResolvedLocation {
  const { provider, bucket, key } = resolveStoredObject(file);

  // Never keyed (upload never signed): nothing in storage
  if (!key) return { kind: "none" };

  const expectedPrefix = `${doc.tenant_id}/${doc.project_id}/${doc.id}/${file.id}/`;
  if (!key.startsWith(expectedPrefix) || !bucket || bucket !== configuredBucket(provider)) {
    return { kind: "untrusted" };
  }

  return { kind: "object", object: { fileId: file.id, provider, bucket, key } };
}

/**
 * Extracts only <Code> and <Message> from an S3 XML error body (or a JSON
 * error), so logs never include the canonical request, string-to-sign or URL.
 */
async function readS3Error(response: Response): Promise<{ s3_code?: string; s3_message?: string }> {
  try {
    const text = (await response.text()).slice(0, 4096);
    const xmlCode = text.match(/<Code>([^<]*)<\/Code>/)?.[1];
    const xmlMessage = text.match(/<Message>([^<]*)<\/Message>/)?.[1];
    if (xmlCode || xmlMessage) {
      return { s3_code: xmlCode, s3_message: xmlMessage?.slice(0, 300) };
    }
    const json = JSON.parse(text);
    const code = json?.code ?? json?.error ?? json?.statusCode;
    const message = json?.message ?? json?.msg;
    return {
      s3_code: code !== undefined ? String(code).slice(0, 100) : undefined,
      s3_message: typeof message === "string" ? message.slice(0, 300) : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Deletes one stored object. Returns true when the object is gone (deleted or
 * already missing).
 */
async function deleteStoredObject(object: StoredObject): Promise<boolean> {
  const storageConfig = getStorageConfig(object.provider);

  // Server-side request: connect through the internal endpoint, but sign for the
  // host Storage verifies against. Local Kong (KONG_PORT_MAPS) forwards
  // X-Forwarded-Host = internal hostname and X-Forwarded-Port = public port, and
  // Storage rebuilds the SigV4 host from those two headers. For R2 both
  // endpoints are identical, so signing and request URLs are the same.
  const requestEndpoint = new URL(storageConfig.internalEndpoint);
  const signingEndpoint = new URL(storageConfig.internalEndpoint);
  signingEndpoint.port = new URL(storageConfig.endpoint).port;

  const url = new URL(await presignDeleteObject({
    endpoint: signingEndpoint.toString(),
    bucket: object.bucket,
    key: object.key,
    accessKeyId: storageConfig.accessKeyId,
    secretAccessKey: storageConfig.secretAccessKey,
    expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
  }));
  // Only the connection target changes; the signed path and query are untouched
  url.protocol = requestEndpoint.protocol;
  url.host = requestEndpoint.host;

  try {
    const response = await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS) });
    // S3/R2 answer 204 for deleted and missing keys; accept 404 as already gone
    if (response.ok || response.status === 404) {
      await response.body?.cancel();
      return true;
    }
    console.error("delete-document: storage delete failed", {
      document_file_id: object.fileId,
      status: response.status,
      ...(await readS3Error(response)),
    });
    return false;
  } catch (err) {
    console.error("delete-document: storage delete error", { document_file_id: object.fileId, err });
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(null);
  }

  if (req.method !== "POST") {
    return jsonError("Método não permitido", 405);
  }

  try {
    const { token } = await requireUser(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("Pedido inválido");
    }

    const documentId = body.document_id;
    const projectId = body.project_id;
    if (typeof documentId !== "string" || !UUID_RE.test(documentId) ||
        typeof projectId !== "string" || !UUID_RE.test(projectId)) {
      return jsonError("document_id e project_id são obrigatórios");
    }

    // User-scoped client: RLS limits every read/write below to the user's tenants
    const supabase = createUserSupabaseClient(token);

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, tenant_id, project_id")
      .eq("id", documentId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (docError) {
      console.error("delete-document: fetch document error", docError);
      return jsonError("Erro ao eliminar documento", 500);
    }
    if (!doc) {
      // Explicit code so clients can tell this apart from a missing route.
      // RLS hides other tenants' rows, so this also covers unauthorized ids.
      return jsonError("Documento não encontrado", 404, { code: "DOCUMENT_NOT_FOUND" });
    }

    const { data: files, error: filesError } = await supabase
      .from("document_files")
      .select("id, storage_provider, storage_bucket, storage_key, r2_bucket, r2_key")
      .eq("document_id", doc.id);

    if (filesError) {
      console.error("delete-document: fetch files error", filesError);
      return jsonError("Erro ao eliminar documento", 500);
    }

    // 1) Validate every storage location before changing anything: a row that
    //    points outside this document's key prefix is never deleted or dropped
    const locations = (files ?? []).map((file) => ({
      fileId: (file as DocumentFileRow).id,
      location: resolveLocation(file as DocumentFileRow, doc),
    }));
    const untrusted = locations.filter(({ location }) => location.kind === "untrusted");
    if (untrusted.length > 0) {
      console.error("delete-document: untrusted storage location", {
        document_id: doc.id,
        document_file_ids: untrusted.map(({ fileId }) => fileId),
      });
      return jsonError(
        "Não é possível eliminar este documento em segurança. Contacte o suporte.",
        409,
        { code: "STORAGE_LOCATION_UNTRUSTED" },
      );
    }

    // 2) Tombstone: downloads and ZIP exports only use status = 'uploaded',
    //    so the files stop being served even if a later step fails
    if (files && files.length > 0) {
      const { error: tombstoneError } = await supabase
        .from("document_files")
        .update({ status: "deleted" })
        .eq("document_id", doc.id)
        .neq("status", "deleted");

      if (tombstoneError) {
        console.error("delete-document: tombstone error", tombstoneError);
        return jsonError("Erro ao eliminar documento", 500);
      }
    }

    // 3) Remove stored objects while the rows that locate them still exist.
    //    On any failure the document row is kept so a retry can finish the job.
    const objects = locations.flatMap(({ location }) => location.kind === "object" ? [location.object] : []);
    const results = await Promise.all(objects.map(deleteStoredObject));
    if (results.some((ok) => !ok)) {
      return jsonError(
        "Não foi possível eliminar os ficheiros do documento. Tente novamente.",
        502,
        { code: "STORAGE_DELETE_FAILED" },
      );
    }

    // 4) Delete the document; document_files and expense_documents cascade
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (deleteError) {
      console.error("delete-document: delete row error", deleteError);
      return jsonError("Erro ao eliminar documento", 500);
    }

    return jsonResponse({ ok: true, document_id: doc.id, deleted_files: files?.length ?? 0 });
  } catch (err) {
    console.error("delete-document error:", err);
    if (err instanceof Response) return err;
    return jsonError("Erro interno do servidor", 500);
  }
});
