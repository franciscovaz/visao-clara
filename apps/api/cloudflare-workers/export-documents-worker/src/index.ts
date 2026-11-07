import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { ZipWriter } from "@zip.js/zip.js";
import { createStorageBackend, getConfiguredBuckets, StorageBackend, Env } from "./storage.ts";
import { resolveTrustedStorageObject } from "../../../supabase/functions/_shared/storage_identity.ts";

class UntrustedStorageError extends Error {
  constructor(public fileId: string, public reason: string) {
    super(`Untrusted storage location for file ${fileId}: ${reason}`);
  }
}

interface ExportPayload {
  project_id: string;
  user_id: string;
  tenant_id: string;
  scope: string;
}

interface DocumentFile {
  id: string;
  tenant_id: string;
  project_id: string;
  document_id: string;
  file_name: string;
  storage_provider: string | null;
  storage_bucket: string | null;
  storage_key: string | null;
  r2_bucket: string | null;
  r2_key: string | null;
  status: string;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ZIP entry name from a stored file name: keeps accents and spaces, but a name can never
// add path segments or climb out of "documentos/"
function safeZipEntryName(fileName: string): string {
  // deno-lint-ignore no-control-regex
  const cleaned = fileName.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim();
  return cleaned === "" || cleaned === "." || cleaned === ".." ? "ficheiro" : cleaned;
}

/**
 * Object keys read from the database are never used as-is: each must sit under its own
 * tenant/project/document/file prefix, and the row's provider and bucket must be the ones
 * this Worker serves. Any inconsistent row fails the whole export (fail closed).
 */
function resolveTrustedKeys(files: DocumentFile[], env: Env, payload: ExportPayload): Map<string, string> {
  const buckets = getConfiguredBuckets(env);
  const keys = new Map<string, string>();

  for (const file of files) {
    if (file.tenant_id !== payload.tenant_id || file.project_id !== payload.project_id) {
      throw new UntrustedStorageError(file.id, "SCOPE_MISMATCH");
    }
    const resolved = resolveTrustedStorageObject(file, buckets);
    if (!resolved.ok) {
      throw new UntrustedStorageError(file.id, resolved.reason);
    }
    keys.set(file.id, resolved.object.key);
  }

  return keys;
}

async function validateToken(token: string, secret: string): Promise<ExportPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    issuer: "visao-clara-edge",
    audience: "visao-clara-worker",
  });

  if (payload.scope !== "documents_export" && payload.scope !== "full_export") {
    throw new Error("Invalid token scope");
  }

  return payload as ExportPayload;
}

async function getDocumentFiles(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  projectId: string
): Promise<DocumentFile[]> {
  const { data, error } = await supabase
    .from("document_files")
    .select("id, tenant_id, project_id, document_id, file_name, storage_provider, storage_bucket, storage_key, r2_bucket, r2_key, status")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .eq("status", "uploaded");

  if (error) {
    throw new Error(`Failed to fetch document files: ${error.message}`);
  }

  return data || [];
}

async function preValidateFiles(
  files: DocumentFile[],
  keys: Map<string, string>,
  storage: StorageBackend
): Promise<void> {
  for (const file of files) {
    const key = keys.get(file.id);
    if (!key) {
      throw new Error(`File ${file.file_name} has no storage key`);
    }

    const exists = await storage.head(key);
    if (!exists) {
      throw new Error(`File not found in storage: ${file.file_name}`);
    }
  }
}

function handleDuplicateFilenames(files: DocumentFile[]): Map<string, string> {
  const nameCounts = new Map<string, number>();
  const finalNames = new Map<string, string>();

  for (const file of files) {
    const baseName = safeZipEntryName(file.file_name);
    const count = nameCounts.get(baseName) || 0;
    nameCounts.set(baseName, count + 1);

    if (count === 0) {
      finalNames.set(file.id, baseName);
    } else {
      const ext = baseName.includes(".") ? baseName.substring(baseName.lastIndexOf(".")) : "";
      const nameWithoutExt = baseName.includes(".") ? baseName.substring(0, baseName.lastIndexOf(".")) : baseName;
      finalNames.set(file.id, `${nameWithoutExt}_${count}${ext}`);
    }
  }

  return finalNames;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const token = url.searchParams.get("token");

      if (!token) {
        return new Response(
          JSON.stringify({ error: "MISSING_TOKEN", reason: "Export token is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const payload = await validateToken(token, env.EXPORT_JWT_SECRET);

      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

      const files = await getDocumentFiles(supabase, payload.tenant_id, payload.project_id);

      const isFullExport = payload.scope === "full_export";

      if (!isFullExport && files.length === 0) {
        return new Response(
          JSON.stringify({ error: "NO_FILES", reason: "No documents found for export" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      const trustedKeys = resolveTrustedKeys(files, env, payload);

      const storage = createStorageBackend(env);

      if (files.length > 0) {
        await preValidateFiles(files, trustedKeys, storage);
      }

      const filenameMap = files.length > 0 ? handleDuplicateFilenames(files) : new Map();

      let xlsxStream: ReadableStream<Uint8Array> | null = null;

      if (isFullExport) {
        const xlsxUrl = `${env.SUPABASE_URL}/functions/v1/get-project-expenses-xlsx?token=${token}&project_id=${payload.project_id}`;
        const xlsxResponse = await fetch(xlsxUrl);

        if (!xlsxResponse.ok) {
          const errorText = await xlsxResponse.text().catch(() => "Unknown error");
          console.error("XLSX fetch failed:", xlsxResponse.status, errorText);
          return new Response(
            JSON.stringify({ error: "XLSX_FETCH_FAILED", reason: `Failed to fetch expenses spreadsheet: ${xlsxResponse.status}` }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }

        const body = xlsxResponse.body;
        if (!body) {
          return new Response(
            JSON.stringify({ error: "XLSX_NO_BODY", reason: "XLSX response has no body" }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }

        xlsxStream = body;
      }

      const { readable, writable } = new TransformStream();

      const zipWriter = new ZipWriter(writable, { zip64: true });

      (async () => {
        try {
          if (isFullExport && xlsxStream) {
            await zipWriter.add("visao-clara-despesas.xlsx", xlsxStream, {
              compressionMethod: 0,
            });
          }

          for (const file of files) {
            const key = trustedKeys.get(file.id)!;
            const fileName = filenameMap.get(file.id) || sanitizeFileName(file.file_name);

            const fileStream = await storage.get(key);

            await zipWriter.add(`documentos/${fileName}`, fileStream, {
              compressionMethod: 0,
            });
          }

          await zipWriter.close();
        } catch (error) {
          console.error("ZIP generation error:", error);
          writable.abort(error);
        }
      })();

      const filename = isFullExport ? "visao-clara-exportacao-completa.zip" : "visao-clara-documentos.zip";

      return new Response(readable, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("Export worker error:", error);

      if (error instanceof UntrustedStorageError) {
        console.error("Untrusted storage location:", { document_file_id: error.fileId, reason: error.reason });
        return new Response(
          JSON.stringify({ error: "STORAGE_LOCATION_UNTRUSTED", reason: "Export blocked: inconsistent storage metadata" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      if (error instanceof Error) {
        if (error.message.includes("JWT") || error.message.includes("token")) {
          return new Response(
            JSON.stringify({ error: "INVALID_TOKEN", reason: error.message }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        if (error.message.includes("not found")) {
          return new Response(
            JSON.stringify({ error: "FILE_MISSING", reason: error.message }),
            { status: 409, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to generate export" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
