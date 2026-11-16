// POST { project_id: uuid, older_than_hours?: number }
//
// Cleans up the CALLER'S OWN abandoned uploads in one project once they are older than
// older_than_hours (default 24, minimum 1, maximum 2160):
//   pending -> failed (never served) -> storage object deleted -> deleted
//   failed  -> storage object deleted (retry) -> deleted
// It never touches other users' uploads, other projects or other tenants, and the object
// location is only used after the S1 storage identity checks. Idempotent: running it again
// only retries what is left. Rows whose object could not be removed stay 'failed' and are
// retried by the next run.
//
// Response: { ok, updated_count (pending -> failed), deleted_count (objects removed and rows
// marked deleted), delete_failed_count, untrusted_count, document_file_ids }
//
// API changes (S1/S2 hardening): project_id is required; older_than_hours below 1 is rejected
// (presigned upload URLs live 5 minutes, so younger uploads may still be in progress); object
// deletion is new. This function is NOT scheduled yet: see "Cleanup scheduling" in
// apps/api/README.md (production-launch blocker).
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { jsonError, jsonResponse } from "../_shared/http.ts";
import { createServiceSupabaseClient, createUserSupabaseClient } from "../_shared/supabase.ts";
import { fileBelongsToDocument, parseCleanupRequest } from "../_shared/document_guards.ts";
import { getConfiguredBuckets } from "../_shared/storage.ts";
import { resolveTrustedStorageObject } from "../_shared/storage_identity.ts";
import { createStorageClient } from "../_shared/storage_server.ts";
import { discardObject } from "../_shared/upload_verify.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(null);
  }

  if (req.method !== "POST") {
    return jsonError("Método não permitido", 405);
  }

  try {
    const { userId, token } = await requireUser(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Pedido inválido");
    }

    const parsed = parseCleanupRequest(body);
    if (!parsed.ok) {
      return jsonError(parsed.error);
    }

    const supabase = createUserSupabaseClient(token);

    // The project must be visible to the user (RLS)
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", parsed.projectId)
      .maybeSingle();

    if (projectError) {
      console.error("cleanup-pending-uploads: project fetch error", projectError);
      return jsonError("Erro interno do servidor", 500);
    }
    if (!project) {
      return jsonError("Projeto não encontrado", 404);
    }

    const cutoffTime = new Date(Date.now() - parsed.olderThanHours * 60 * 60 * 1000).toISOString();

    // Only the caller's own abandoned uploads in this project (RLS also limits to their tenants)
    const { data: candidates, error: fetchError } = await supabase
      .from("document_files")
      .select("id, tenant_id, project_id, document_id, status, storage_provider, storage_bucket, storage_key, r2_bucket, r2_key")
      .eq("project_id", project.id)
      .eq("created_by", userId)
      .in("status", ["pending", "failed"])
      .lt("created_at", cutoffTime);

    if (fetchError) {
      console.error("Fetch pending uploads error:", fetchError);
      return jsonError("Erro ao buscar uploads pendentes", 500);
    }

    const result = {
      updated: [] as string[],
      deleted: [] as string[],
      deleteFailed: 0,
      untrusted: 0,
    };

    if (!candidates || candidates.length === 0) {
      return jsonResponse({ ok: true, updated_count: 0, deleted_count: 0, delete_failed_count: 0, untrusted_count: 0, document_file_ids: [] });
    }

    // document_files state is server-only; ownership and scope were verified above
    const service = createServiceSupabaseClient();
    const buckets = getConfiguredBuckets();

    for (const file of candidates) {
      // 1) Never served again: pending -> failed first
      if (file.status === "pending") {
        const { data: marked, error: markError } = await service
          .from("document_files")
          .update({ status: "failed" })
          .eq("id", file.id)
          .eq("status", "pending")
          .eq("created_by", userId)
          .select("id");
        if (markError) {
          console.error("cleanup-pending-uploads: mark failed error", { document_file_id: file.id, markError });
          continue;
        }
        if (!marked || marked.length === 0) continue; // changed meanwhile (e.g. confirmed): leave it
        result.updated.push(file.id);
      }

      // 2) Remove the stored object, only for a trusted location (S1)
      const { data: doc } = await supabase
        .from("documents")
        .select("id, tenant_id, project_id")
        .eq("id", file.document_id)
        .maybeSingle();
      const resolved = fileBelongsToDocument(file, doc) ? resolveTrustedStorageObject(file, buckets) : null;

      if (!resolved) {
        result.untrusted++;
        continue;
      }
      if (!resolved.ok) {
        if (resolved.reason === "KEY_MISSING") {
          // Never keyed: nothing in storage
          await markDeleted(service, file.id, userId, result);
        } else {
          console.error("cleanup-pending-uploads: untrusted storage location", { document_file_id: file.id, reason: resolved.reason });
          result.untrusted++;
        }
        continue;
      }

      const removed = await discardObject(createStorageClient(resolved.object));
      if (!removed) {
        result.deleteFailed++;
        continue;
      }

      // 3) Object gone: failed -> deleted (late confirm is no longer possible)
      await markDeleted(service, file.id, userId, result);
    }

    return jsonResponse({
      ok: true,
      updated_count: result.updated.length,
      deleted_count: result.deleted.length,
      delete_failed_count: result.deleteFailed,
      untrusted_count: result.untrusted,
      document_file_ids: result.updated,
    });
  } catch (err) {
    console.error("cleanup-pending-uploads error:", err);
    if (err instanceof Response) return err;

    return jsonError("Erro interno do servidor", 500);
  }
});

async function markDeleted(
  service: ReturnType<typeof createServiceSupabaseClient>,
  fileId: string,
  userId: string,
  result: { deleted: string[] },
) {
  const { error } = await service
    .from("document_files")
    .update({ status: "deleted" })
    .eq("id", fileId)
    .eq("status", "failed")
    .eq("created_by", userId);
  if (error) {
    console.error("cleanup-pending-uploads: mark deleted error", { document_file_id: fileId, error });
    return;
  }
  result.deleted.push(fileId);
}
