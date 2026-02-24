import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { presignGetObject } from "../_shared/r2_signer.ts";
import { getUserOrThrow } from "../_shared/auth.ts";

const EXPIRES_IN_SECONDS = 600;

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

    // Fetch document_files row (RLS ensures access)
    const { data: documentFile, error: fetchError } = await supabase
      .from("document_files")
      .select("r2_key, status")
      .eq("id", documentFileId)
      .single();

    if (fetchError || !documentFile) {
      console.error("Fetch document file error:", fetchError);
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro não encontrado ou acesso negado" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!documentFile.r2_key || documentFile.status !== "uploaded") {
      return new Response(
        JSON.stringify({ ok: false, error: "Ficheiro não disponível para download" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate presigned GET URL
    const r2Endpoint = getEnv("R2_ENDPOINT");
    const r2Bucket = getEnv("R2_BUCKET");
    const r2AccessKeyId = getEnv("R2_ACCESS_KEY_ID");
    const r2SecretAccessKey = getEnv("R2_SECRET_ACCESS_KEY");

    const downloadUrl = await presignGetObject({
      endpoint: r2Endpoint,
      bucket: r2Bucket,
      key: documentFile.r2_key,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      expiresInSeconds: EXPIRES_IN_SECONDS,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        download: {
          url: downloadUrl,
          expires_in: EXPIRES_IN_SECONDS,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("r2-sign-download error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
