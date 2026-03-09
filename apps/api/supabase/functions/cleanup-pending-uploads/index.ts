import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { requireUser } from "../_shared/auth.ts";

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
    return new Response(
      JSON.stringify({ ok: false, error: "Método não permitido" }),
      {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      },
    );
  }

  try {
    // Parse request body
    const body = await req.json();
    const olderThanHours = Number(body.older_than_hours) || 24;

    if (!Number.isFinite(olderThanHours) || olderThanHours <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "older_than_hours deve ser um número positivo" }),
        {
          status: 400,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        },
      );
    }

    // Authenticate user
    const user = await requireUser(req);
    const supabase = createClient(
      Deno.env.get("VC_SUPABASE_URL")!,
      Deno.env.get("VC_SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        },
      },
    );

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
      return new Response(
        JSON.stringify({
          ok: true,
          updated_count: 0,
          document_file_ids: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        },
      );
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
      return new Response(
        JSON.stringify({ ok: false, error: "Erro ao atualizar uploads pendentes" }),
        {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        },
      );
    }

    const updatedIds = updatedFiles?.map((file) => file.id) || [];

    return new Response(
      JSON.stringify({
        ok: true,
        updated_count: updatedIds.length,
        document_file_ids: updatedIds,
      }),
      {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("cleanup-pending-uploads error:", err);
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
