import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { requireUser } from "../_shared/auth.ts";
import { jsonError, jsonResponse } from "../_shared/http.ts";
import { createUserSupabaseClient } from "../_shared/supabase.ts";

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

  // Only accept POST
  if (req.method !== "POST") {
    return jsonError("Método não permitido", 405);
  }

  try {
    // Parse request body
    const body = await req.json();
    const olderThanHours = Number(body.older_than_hours) || 24;

    if (!Number.isFinite(olderThanHours) || olderThanHours <= 0) {
      return jsonError("older_than_hours deve ser um número positivo");
    }

    // Authenticate user
    const user = await requireUser(req);
    const supabase = createUserSupabaseClient(user.token);

    // Calculate cutoff time
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

    // Find pending uploads older than cutoff
    const { data: pendingFiles, error: fetchError } = await supabase
      .from("document_files")
      .select("id, created_at")
      .eq("status", "pending")
      .lt("created_at", cutoffTime);

    if (fetchError) {
      console.error("Fetch pending uploads error:", fetchError);
      return new Response(
        JSON.stringify({ ok: false, error: "Erro ao buscar uploads pendentes" }),
        {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        },
      );
    }

    if (!pendingFiles || pendingFiles.length === 0) {
      return jsonResponse({
        ok: true,
        updated_count: 0,
        document_file_ids: [],
      });
    }

    // Update all pending files to failed
    const fileIds = pendingFiles.map((file) => file.id);
    const { data: updatedFiles, error: updateError } = await supabase
      .from("document_files")
      .update({ status: "failed" })
      .in("id", fileIds)
      .select("id");

    if (updateError) {
      console.error("Update pending uploads error:", updateError);
      return jsonError("Erro ao atualizar uploads pendentes");
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

    return jsonError("Erro interno do servidor");
  }
});
