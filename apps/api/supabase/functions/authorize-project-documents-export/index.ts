import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { SignJWT } from "https://esm.sh/jose@5.1.0";
import { requireUser } from "../_shared/auth.ts";
import { createUserSupabaseClient } from "../_shared/supabase.ts";
import {
  decideExport,
  EXPORT_TOKEN_AUDIENCE,
  EXPORT_TOKEN_ISSUER,
  EXPORT_TOKEN_TTL_SECONDS as EXPIRY_SECONDS,
} from "../_shared/export_access.ts";

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

    if (!projectId || typeof projectId !== "string") {
      return new Response(
        JSON.stringify({ error: "INVALID_REQUEST", reason: "Missing or invalid project_id" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // The caller's plan and the project are read with THEIR token, so RLS applies: a project of
    // another tenant is indistinguishable from a missing one (project === null).
    const supabase = createUserSupabaseClient(token);

    const [{ data: profile }, { data: project }] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
      supabase.from("projects").select("id, tenant_id").eq("id", projectId).maybeSingle(),
    ]);

    const decision = decideExport({
      exportType: body.export_type,
      plan: profile?.plan ?? null,
      project: project ?? null,
    });
    if (!decision.ok) {
      return new Response(
        JSON.stringify({ error: decision.error, reason: decision.reason }),
        { status: decision.status, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const exportJwtSecret = getEnv("EXPORT_JWT_SECRET");

    const exportToken = await new SignJWT({
      project_id: projectId,
      user_id: userId,
      tenant_id: decision.tenantId,
      scope: decision.scope,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer(EXPORT_TOKEN_ISSUER)
      .setAudience(EXPORT_TOKEN_AUDIENCE)
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
