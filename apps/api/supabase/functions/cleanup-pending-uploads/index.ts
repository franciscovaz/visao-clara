// POST { project_id: uuid, older_than_hours?: number }
//
// Marks the CALLER'S OWN pending uploads in one project as failed once they are older than
// older_than_hours (default 24, minimum 1, maximum 2160). It never touches other users'
// uploads, other projects, or storage objects.
//
// API change (S1 hardening): project_id is now required, and older_than_hours below 1 is
// rejected (presigned upload URLs live 15 minutes, so younger uploads may still be active).
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { jsonError, jsonResponse } from "../_shared/http.ts";
import { createServiceSupabaseClient, createUserSupabaseClient } from "../_shared/supabase.ts";
import { parseCleanupRequest } from "../_shared/document_guards.ts";

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

    // Only the caller's own pending uploads in this project
    const { data: pendingFiles, error: fetchError } = await supabase
      .from("document_files")
      .select("id")
      .eq("project_id", project.id)
      .eq("created_by", userId)
      .eq("status", "pending")
      .lt("created_at", cutoffTime);

    if (fetchError) {
      console.error("Fetch pending uploads error:", fetchError);
      return jsonError("Erro ao buscar uploads pendentes", 500);
    }

    if (!pendingFiles || pendingFiles.length === 0) {
      return jsonResponse({ ok: true, updated_count: 0, document_file_ids: [] });
    }

    // document_files state is server-only; ownership and scope were verified above
    const fileIds = pendingFiles.map((file) => file.id);
    const { data: updatedFiles, error: updateError } = await createServiceSupabaseClient()
      .from("document_files")
      .update({ status: "failed" })
      .in("id", fileIds)
      .eq("status", "pending")
      .eq("created_by", userId)
      .select("id");

    if (updateError) {
      console.error("Update pending uploads error:", updateError);
      return jsonError("Erro ao atualizar uploads pendentes", 500);
    }

    const updatedIds = updatedFiles?.map((file) => file.id) || [];

    return jsonResponse({
      ok: true,
      updated_count: updatedIds.length,
      document_file_ids: updatedIds,
    });
  } catch (err) {
    console.error("cleanup-pending-uploads error:", err);
    if (err instanceof Response) return err;

    return jsonError("Erro interno do servidor", 500);
  }
});
