import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { SignJWT } from "https://esm.sh/jose@5.1.0";
import { requireUser } from "../_shared/auth.ts";
import { createUserSupabaseClient } from "../_shared/supabase.ts";

const EXPIRY_SECONDS = 300;

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-jwt, apikey",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED", reason: "Only POST requests are allowed" }),
      { status: 405, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  try {
    const auth = await requireUser(req);
    const { userId, token } = auth;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "INVALID_REQUEST", reason: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const projectId = body.project_id as string;
    const exportType = body.export_type as string || "documents";

    if (!projectId || typeof projectId !== "string") {
      return new Response(
        JSON.stringify({ error: "INVALID_REQUEST", reason: "Missing or invalid project_id" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (!["documents", "full"].includes(exportType)) {
      return new Response(
        JSON.stringify({ error: "INVALID_REQUEST", reason: "export_type must be 'documents' or 'full'" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const supabase = createUserSupabaseClient(token);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "FORBIDDEN", reason: "Unable to verify user plan" }),
        { status: 403, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (profile.plan === "free") {
      return new Response(
        JSON.stringify({ error: "FORBIDDEN", reason: "Document export requires Pro plan" }),
        { status: 403, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, tenant_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "FORBIDDEN", reason: "Project not found or access denied" }),
        { status: 403, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const exportJwtSecret = getEnv("EXPORT_JWT_SECRET");

    const scope = exportType === "full" ? "full_export" : "documents_export";

    const exportToken = await new SignJWT({
      project_id: projectId,
      user_id: userId,
      tenant_id: project.tenant_id,
      scope,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("visao-clara-edge")
      .setAudience("visao-clara-worker")
      .setExpirationTime(`${EXPIRY_SECONDS}s`)
      .sign(new TextEncoder().encode(exportJwtSecret));

    return new Response(
      JSON.stringify({
        ok: true,
        export_token: exportToken,
        expires_in: EXPIRY_SECONDS,
      }),
      { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("authorize-project-documents-export error:", err);
    if (err instanceof Response) return err;

    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", reason: "Unexpected server error" }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      },
    );
  }
});
