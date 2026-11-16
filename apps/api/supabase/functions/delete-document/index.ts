import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { getConfiguredBuckets } from "../_shared/storage.ts";
import { createStorageClient } from "../_shared/storage_server.ts";
import { resolveTrustedStorageObject, type TrustedStorageObject } from "../_shared/storage_identity.ts";
import { fileBelongsToDocument, isUuid } from "../_shared/document_guards.ts";
import { jsonError, jsonResponse } from "../_shared/http.ts";
import { createServiceSupabaseClient, createUserSupabaseClient } from "../_shared/supabase.ts";

interface DocumentFileRow {
  id: string;
  tenant_id: string;
  project_id: string;
  document_id: string;
  storage_provider: string | null;
  storage_bucket: string | null;
  storage_key: string | null;
  r2_bucket: string | null;
  r2_key: string | null;
}

type ResolvedLocation =
  | { kind: "none" }
  | { kind: "untrusted"; reason: string }
  | { kind: "object"; object: TrustedStorageObject };

/**
 * Storage coordinates come from the DB row, but are only trusted if the row belongs to this
 * document and the key sits under this file's own tenant/project/document/file prefix in the
 * bucket configured for the row's provider (see storage_identity.ts).
 */
function resolveLocation(
  file: DocumentFileRow,
  doc: { id: string; tenant_id: string; project_id: string },
): ResolvedLocation {
  if (!fileBelongsToDocument(file, doc)) return { kind: "untrusted", reason: "DOCUMENT_MISMATCH" };

  // Never keyed (upload never signed): nothing in storage
  if (!file.storage_key && !file.r2_key) return { kind: "none" };

  const resolved = resolveTrustedStorageObject(file, getConfiguredBuckets());
  if (!resolved.ok) return { kind: "untrusted", reason: resolved.reason };
  return { kind: "object", object: resolved.object };
}

/**
 * Deletes one stored object. Returns true when the object is gone (deleted or
 * already missing).
 */
function deleteStoredObject(object: TrustedStorageObject): Promise<boolean> {
  return createStorageClient(object).delete();
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
    if (typeof documentId !== "string" || !isUuid(documentId) ||
        typeof projectId !== "string" || !isUuid(projectId)) {
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
      .select("id, tenant_id, project_id, document_id, storage_provider, storage_bucket, storage_key, r2_bucket, r2_key")
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
        files: untrusted.map(({ fileId, location }) => ({
          document_file_id: fileId,
          reason: location.kind === "untrusted" ? location.reason : undefined,
        })),
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
      // document_files state is server-only; access to the document was verified above
      const { error: tombstoneError } = await createServiceSupabaseClient()
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
