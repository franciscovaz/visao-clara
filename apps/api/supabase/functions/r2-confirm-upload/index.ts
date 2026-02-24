import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { getUserOrThrow } from "../_shared/auth.ts";

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
    const { supabase } = authResult;

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
