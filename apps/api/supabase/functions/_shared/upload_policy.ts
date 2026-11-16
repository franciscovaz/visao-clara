// Upload policy for document files: allowed types, size limits, content signatures and the
// safe download file name. Pure module (no Deno or network APIs) so it can be unit-tested.
//
// Guarantees vs best effort:
//  - size and Content-Type are enforced by Cloudflare R2 itself (they are signed headers) and
//    re-checked against the stored object before an upload is confirmed;
//  - the content check below is a SANITY check on the first bytes (magic numbers), not a
//    malware scan: legacy Office files share one container signature and Office Open XML files
//    are ZIP archives whose full structure is not parsed.

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MIN_FILE_SIZE_BYTES = 1;
export const SIGNATURE_RANGE_BYTES = 128; // size of the ranged GET used for the signature check

export type FileKind = "pdf" | "png" | "jpeg" | "ole2" | "ooxml";

interface AllowedType {
  kind: FileKind;
  extensions: readonly string[];
}

export const ALLOWED_TYPES: Readonly<Record<string, AllowedType>> = {
  "application/pdf": { kind: "pdf", extensions: ["pdf"] },
  "image/png": { kind: "png", extensions: ["png"] },
  "image/jpeg": { kind: "jpeg", extensions: ["jpg", "jpeg"] },
  "application/msword": { kind: "ole2", extensions: ["doc"] },
  "application/vnd.ms-excel": { kind: "ole2", extensions: ["xls"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "ooxml", extensions: ["docx"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { kind: "ooxml", extensions: ["xlsx"] },
};

export function normalizeMime(value: string | null | undefined): string {
  return (value ?? "").split(";")[0].trim().toLowerCase();
}

export function fileExtension(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i > 0 && i < fileName.length - 1 ? fileName.slice(i + 1).toLowerCase() : "";
}

export type UploadValidation = { ok: true; kind: FileKind } | { ok: false; error: string };

/** Validates the client's claim before any row is created or URL is signed. */
export function validateUploadRequest(
  input: { fileName: string; mimeType: string; sizeBytes: number },
): UploadValidation {
  const mime = normalizeMime(input.mimeType);
  const type = ALLOWED_TYPES[mime];
  if (!type || mime !== input.mimeType) {
    return { ok: false, error: `Tipo de ficheiro não permitido: ${input.mimeType.slice(0, 80)}` };
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < MIN_FILE_SIZE_BYTES) {
    return { ok: false, error: "O ficheiro está vazio ou o tamanho é inválido" };
  }
  if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "Ficheiro excede o tamanho máximo de 20MB" };
  }
  if (!type.extensions.includes(fileExtension(input.fileName))) {
    return { ok: false, error: "A extensão do ficheiro não corresponde ao tipo indicado" };
  }
  return { ok: true, kind: type.kind };
}

const startsWith = (bytes: Uint8Array, sig: readonly number[], at = 0) =>
  bytes.length >= at + sig.length && sig.every((b, i) => bytes[at + i] === b);

const OFFICE_ENTRY_PREFIXES = ["[Content_Types].xml", "_rels/", "docProps/", "word/", "xl/", "customXml/"];

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

/** Checks the first bytes of an object against the signature expected for its declared type. */
export function checkFileSignature(mimeType: string, bytes: Uint8Array): SignatureCheck {
  const type = ALLOWED_TYPES[normalizeMime(mimeType)];
  if (!type) return { ok: false, reason: "TYPE_NOT_ALLOWED" };

  switch (type.kind) {
    case "pdf":
      // %PDF-
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) ? { ok: true } : { ok: false, reason: "SIGNATURE_MISMATCH" };
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        ? { ok: true }
        : { ok: false, reason: "SIGNATURE_MISMATCH" };
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]) ? { ok: true } : { ok: false, reason: "SIGNATURE_MISMATCH" };
    case "ole2":
      // Compound File Binary header (legacy .doc and .xls share it)
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
        ? { ok: true }
        : { ok: false, reason: "SIGNATURE_MISMATCH" };
    case "ooxml": {
      // ZIP local file header, whose first entry name must look like an Office Open XML part
      if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return { ok: false, reason: "SIGNATURE_MISMATCH" };
      if (bytes.length < 30) return { ok: false, reason: "SIGNATURE_MISMATCH" };
      const nameLength = bytes[26] | (bytes[27] << 8);
      if (nameLength === 0 || bytes.length < 30 + nameLength) return { ok: false, reason: "SIGNATURE_MISMATCH" };
      const name = new TextDecoder("utf-8").decode(bytes.subarray(30, 30 + nameLength));
      return OFFICE_ENTRY_PREFIXES.some((p) => name.startsWith(p)) ? { ok: true } : { ok: false, reason: "SIGNATURE_MISMATCH" };
    }
  }
}

export type StoredObjectCheck = { ok: true } | { ok: false; reason: "EMPTY" | "TOO_LARGE" | "SIZE_MISMATCH" | "TYPE_MISMATCH" };

/** Compares what storage reports for the object (HEAD) with the database record. */
export function checkStoredObject(
  head: { contentLength: number | null; contentType: string | null },
  record: { sizeBytes: number; mimeType: string },
): StoredObjectCheck {
  const length = head.contentLength;
  if (length === null || !Number.isFinite(length)) return { ok: false, reason: "SIZE_MISMATCH" };
  if (length < MIN_FILE_SIZE_BYTES) return { ok: false, reason: "EMPTY" };
  if (length > MAX_FILE_SIZE_BYTES) return { ok: false, reason: "TOO_LARGE" };
  if (length !== record.sizeBytes) return { ok: false, reason: "SIZE_MISMATCH" };
  if (normalizeMime(head.contentType) !== normalizeMime(record.mimeType)) return { ok: false, reason: "TYPE_MISMATCH" };
  return { ok: true };
}

/**
 * Content-Disposition value forcing a download. The name is reduced to a safe ASCII fallback
 * plus an RFC 5987 UTF-8 form; path separators, quotes and control characters never survive.
 */
export function attachmentDisposition(fileName: string): string {
  // deno-lint-ignore no-control-regex
  const cleaned = fileName.replace(/[\u0000-\u001f\u007f/\\"]/g, "_").trim().slice(0, 200);
  const base = cleaned === "" || cleaned === "." || cleaned === ".." ? "ficheiro" : cleaned;
  const ascii = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/%/g, "_");
  const encoded = encodeURIComponent(base).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
