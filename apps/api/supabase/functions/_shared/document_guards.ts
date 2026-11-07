// Pure authorization/consistency checks shared by the document Edge Functions.
// Kept free of Deno and Supabase imports so they can be unit-tested.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * The project row read through the user's RLS-scoped client must exist and belong to the
 * tenant the request names. A request naming a tenant the user belongs to together with a
 * project of another tenant is refused (RLS hides foreign projects, so null is also refused).
 */
export function projectBelongsToTenant(
  project: { id: string; tenant_id: string } | null | undefined,
  projectId: string,
  tenantId: string,
): boolean {
  return !!project && project.id === projectId && project.tenant_id === tenantId;
}

/**
 * A document_files row must point at the document, tenant and project it claims. The
 * document is read through the user's client, so a document of another tenant is never
 * returned and a row referencing one is refused.
 */
export function fileBelongsToDocument(
  file: { document_id: string; tenant_id: string; project_id: string },
  doc: { id: string; tenant_id: string; project_id: string } | null | undefined,
): boolean {
  return !!doc &&
    file.document_id === doc.id &&
    file.tenant_id === doc.tenant_id &&
    file.project_id === doc.project_id;
}

export const CLEANUP_MIN_AGE_HOURS = 1; // presigned upload URLs live 15 minutes
export const CLEANUP_DEFAULT_AGE_HOURS = 24;
export const CLEANUP_MAX_AGE_HOURS = 24 * 90;

export type CleanupRequest =
  | { ok: true; projectId: string; olderThanHours: number }
  | { ok: false; error: string };

/** Validates the cleanup-pending-uploads body: project-scoped, with a safe minimum age. */
export function parseCleanupRequest(body: unknown): CleanupRequest {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (!isUuid(input.project_id)) {
    return { ok: false, error: "project_id é obrigatório" };
  }

  let olderThanHours = CLEANUP_DEFAULT_AGE_HOURS;
  if (input.older_than_hours !== undefined && input.older_than_hours !== null) {
    olderThanHours = Number(input.older_than_hours);
    if (
      !Number.isFinite(olderThanHours) ||
      olderThanHours < CLEANUP_MIN_AGE_HOURS ||
      olderThanHours > CLEANUP_MAX_AGE_HOURS
    ) {
      return {
        ok: false,
        error: `older_than_hours deve estar entre ${CLEANUP_MIN_AGE_HOURS} e ${CLEANUP_MAX_AGE_HOURS}`,
      };
    }
  }

  return { ok: true, projectId: input.project_id.toLowerCase(), olderThanHours };
}
