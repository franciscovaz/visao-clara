// Export authorization rules shared by the Edge Functions and the export Worker.
//
// Pure module on purpose (no jose / supabase imports): the Worker bundles it from this path and
// the Deno tests run it directly. The signing and verification calls stay in each runtime; what
// is shared is everything that decides WHO may export WHAT:
//   - the token constants and the exact jose verification options (EXPORT_VERIFY_OPTIONS),
//   - which scopes each endpoint accepts, and a strict check of the verified claims,
//   - the plan / project decision made when a token is requested,
//   - the classification of jose errors (an invalid or expired token is a 401, never a 500).
import { isUuid } from "./document_guards.ts";

export const EXPORT_TOKEN_ISSUER = "visao-clara-edge";
export const EXPORT_TOKEN_AUDIENCE = "visao-clara-worker";
export const EXPORT_TOKEN_TTL_SECONDS = 300;

/**
 * Options for jose `jwtVerify` in every verifier. `algorithms` pins HS256 so a token can never
 * pick its own algorithm.
 */
export const EXPORT_VERIFY_OPTIONS: { issuer: string; audience: string; algorithms: string[] } = {
  issuer: EXPORT_TOKEN_ISSUER,
  audience: EXPORT_TOKEN_AUDIENCE,
  algorithms: ["HS256"],
};

export type ExportScope = "documents_export" | "full_export" | "expenses_export";

/** Scopes the Worker serves (it never issues or accepts expenses_export). */
export const WORKER_SCOPES: readonly ExportScope[] = ["documents_export", "full_export"];
/** Scopes get-project-expenses-xlsx serves (the Worker calls it for full exports). */
export const XLSX_SCOPES: readonly ExportScope[] = ["full_export", "expenses_export"];

export interface ExportClaims {
  project_id: string;
  tenant_id: string;
  user_id: string;
  scope: ExportScope;
}

export type ClaimsResult =
  | { ok: true; claims: ExportClaims }
  | { ok: false; status: 401 | 403; error: "INVALID_TOKEN" | "INVALID_SCOPE" | "PROJECT_MISMATCH"; reason: string };

/**
 * Checks the claims of a token whose signature, issuer, audience and expiry jose has already
 * verified. Fails closed: ids must be real UUIDs (they are used as database filters), the scope
 * must be one this endpoint serves and, when the request names a project, it must be the token's.
 */
export function parseExportClaims(
  payload: Record<string, unknown>,
  options: { allowedScopes: readonly ExportScope[]; projectId?: string },
): ClaimsResult {
  const { project_id, tenant_id, user_id, scope } = payload;

  if (!isUuid(project_id) || !isUuid(tenant_id) || !isUuid(user_id)) {
    return { ok: false, status: 401, error: "INVALID_TOKEN", reason: "Malformed token claims" };
  }
  if (typeof scope !== "string" || !(options.allowedScopes as readonly string[]).includes(scope)) {
    return { ok: false, status: 403, error: "INVALID_SCOPE", reason: "Invalid token scope" };
  }
  if (options.projectId !== undefined && options.projectId !== project_id) {
    return { ok: false, status: 403, error: "PROJECT_MISMATCH", reason: "Token project_id does not match request" };
  }

  return { ok: true, claims: { project_id, tenant_id, user_id, scope: scope as ExportScope } };
}

/**
 * Validates the export signing secret read from the environment and returns it UNCHANGED.
 * A missing, empty or whitespace-only value is a misconfiguration: signing or verifying with it
 * would let anyone who guesses it mint valid export tokens. Throws (callers answer a generic 500);
 * the message names the variable only, never the value.
 */
export function requireSigningSecret(value: string | undefined | null): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Missing env: EXPORT_JWT_SECRET");
  }
  return value;
}

/**
 * True for the errors jose throws while verifying a token (bad signature, expired, wrong
 * issuer/audience/algorithm, malformed). Their messages do not mention "JWT" or "token"
 * (e.g. `"exp" claim timestamp check failed`), so they are recognised by `code`.
 */
export function isTokenVerificationError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^ERR_(JWT|JWS|JWE|JOSE)_/.test(code);
}

// ---------------------------------------------------------------------------
// Requesting a token (authorize-project-documents-export)
// ---------------------------------------------------------------------------

/** Pro features. Anything that is not an explicit paid plan is refused (fail closed). */
export function isPaidPlan(plan: unknown): boolean {
  return plan === "pro" || plan === "premium";
}

export type ExportType = "documents" | "full";

export function parseExportType(value: unknown): ExportType | null {
  if (value === undefined || value === null || value === "") return "documents";
  return value === "documents" || value === "full" ? value : null;
}

export type ExportDecision =
  | { ok: true; scope: ExportScope; tenantId: string }
  | { ok: false; status: 400 | 403; error: "INVALID_REQUEST" | "FORBIDDEN"; reason: string };

/**
 * Decides whether a token may be issued. `plan` is the caller's plan read with THEIR token and
 * `project` the project row read with THEIR token (RLS): null for a project that does not exist
 * or belongs to another tenant, which is deliberately indistinguishable. The token's tenant is
 * taken from that row, never from the request.
 */
export function decideExport(input: {
  exportType: unknown;
  plan: string | null | undefined;
  project: { id: string; tenant_id: string } | null | undefined;
}): ExportDecision {
  const exportType = parseExportType(input.exportType);
  if (!exportType) {
    return { ok: false, status: 400, error: "INVALID_REQUEST", reason: "export_type must be 'documents' or 'full'" };
  }
  if (input.plan == null) {
    return { ok: false, status: 403, error: "FORBIDDEN", reason: "Unable to verify user plan" };
  }
  if (!isPaidPlan(input.plan)) {
    return { ok: false, status: 403, error: "FORBIDDEN", reason: "Document export requires Pro plan" };
  }
  if (!input.project || !isUuid(input.project.id) || !isUuid(input.project.tenant_id)) {
    return { ok: false, status: 403, error: "FORBIDDEN", reason: "Project not found or access denied" };
  }
  return {
    ok: true,
    scope: exportType === "full" ? "full_export" : "documents_export",
    tenantId: input.project.tenant_id,
  };
}
