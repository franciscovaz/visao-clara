import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Env var ${name} não definido`);
  return value;
}

serve(async (req) => {
  try {
    // Validate auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Autorização necessária" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const userJwt = authHeader.replace("Bearer ", "").trim();

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

    const documentFileId = body.document_file_id as string;
    if (!documentFileId) {
      return new Response(
        JSON.stringify({ ok: false, error: "document_file_id é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user JWT (RLS applies)
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabase = createClient(supabaseUrl, userJwt, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Update document_files status to uploaded
    const { error: updateError } = await supabase
      .from("document_files")
      .update({ status: "uploaded", uploaded_at: new Date().toISOString() })
      .eq("id", documentFileId);

    if (updateError) {
      console.error("Confirm upload error:", updateError);
      return new Response(
        JSON.stringify({ ok: false, error: "Erro ao confirmar upload" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("r2-confirm-upload error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
