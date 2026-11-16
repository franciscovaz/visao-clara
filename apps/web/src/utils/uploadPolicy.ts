// Document upload policy for the browser. Mirrors apps/api/supabase/functions/_shared/upload_policy.ts
// (the backend and R2 are the real enforcement; this only gives early, clear feedback).

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** Value for <input accept>: always the same list the backend allows. */
export const UPLOAD_ACCEPT = Object.keys(MIME_BY_EXTENSION).map((ext) => `.${ext}`).join(',');

export const UPLOAD_FORMATS_LABEL = 'PDF, DOC, DOCX, XLS, XLSX, JPG e PNG';

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : '';
}

/**
 * MIME type sent to the backend and as the Content-Type of the upload. Derived from the file
 * extension because browsers report inconsistent types for Office files; returns null for
 * unsupported files.
 */
export function resolveUploadMime(file: Pick<File, 'name'>): string | null {
  return MIME_BY_EXTENSION[extensionOf(file.name)] ?? null;
}

/** pt-PT validation message, or null when the file can be uploaded. */
export function validateUploadFile(file: Pick<File, 'name' | 'size'>): string | null {
  if (!resolveUploadMime(file)) {
    return `Tipo de ficheiro não suportado. Formatos permitidos: ${UPLOAD_FORMATS_LABEL}.`;
  }
  if (file.size < 1) {
    return 'O ficheiro está vazio.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'O ficheiro excede o tamanho máximo de 20 MB.';
  }
  return null;
}

/** Headers the upload request may carry. Content-Length is set by the browser itself. */
export function pickUploadHeaders(required: unknown, fallbackContentType: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (required && typeof required === 'object') {
    for (const [name, value] of Object.entries(required as Record<string, unknown>)) {
      const lower = name.toLowerCase();
      if ((lower === 'content-type' || lower === 'if-none-match') && typeof value === 'string') {
        headers[name] = value;
      }
    }
  }
  if (!Object.keys(headers).some((n) => n.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = fallbackContentType;
  }
  return headers;
}
