// Run from apps/api/supabase/functions: deno test --allow-env _shared/
//
// Export authorization: who may obtain an export token, and which tokens the Worker and
// get-project-expenses-xlsx accept. The token tests use real jose signatures and the same
// EXPORT_VERIFY_OPTIONS the production verifiers use.
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { SignJWT, UnsecuredJWT, jwtVerify } from "https://esm.sh/jose@5.1.0";
import {
  decideExport,
  EXPORT_TOKEN_AUDIENCE,
  EXPORT_TOKEN_ISSUER,
  EXPORT_VERIFY_OPTIONS,
  isPaidPlan,
  isTokenVerificationError,
  parseExportClaims,
  parseExportType,
  WORKER_SCOPES,
  XLSX_SCOPES,
} from "./export_access.ts";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const SECRET = new TextEncoder().encode("test-export-secret-0123456789abcdef");
const OTHER_SECRET = new TextEncoder().encode("another-secret-0123456789abcdefgh");

interface SignOptions {
  secret?: Uint8Array;
  alg?: string;
  issuer?: string;
  audience?: string;
  /** Seconds relative to now (negative = already expired) */
  expiresIn?: number;
  claims?: Record<string, unknown>;
}

function sign(opts: SignOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ project_id: PROJECT_A, user_id: USER_A, tenant_id: TENANT_A, scope: "documents_export", ...opts.claims })
    .setProtectedHeader({ alg: opts.alg ?? "HS256" })
    .setIssuedAt(now - 600)
    .setIssuer(opts.issuer ?? EXPORT_TOKEN_ISSUER)
    .setAudience(opts.audience ?? EXPORT_TOKEN_AUDIENCE)
    .setExpirationTime(now + (opts.expiresIn ?? 300))
    .sign(opts.secret ?? SECRET);
}

async function rejection(token: string): Promise<unknown> {
  try {
    await jwtVerify(token, SECRET, EXPORT_VERIFY_OPTIONS);
  } catch (err) {
    return err;
  }
  return null;
}

async function assertRejected(token: string, label: string) {
  const err = await rejection(token);
  assert(err !== null, `${label}: token must be rejected`);
  assert(isTokenVerificationError(err), `${label}: must be classified as a token error (401), got ${String(err)}`);
}

// --- Token verification (signature, expiry, issuer, audience, algorithm) ---------------------

Deno.test("a valid token verifies and exposes its claims", async () => {
  const { payload } = await jwtVerify(await sign(), SECRET, EXPORT_VERIFY_OPTIONS);
  const parsed = parseExportClaims(payload, { allowedScopes: WORKER_SCOPES });
  assert(parsed.ok);
  assertEquals(parsed.claims, { project_id: PROJECT_A, tenant_id: TENANT_A, user_id: USER_A, scope: "documents_export" });
});

Deno.test("expired token is rejected and classified as a token error (401, not 500)", async () => {
  await assertRejected(await sign({ expiresIn: -10 }), "expired");
});

Deno.test("token signed with another secret is rejected", async () => {
  await assertRejected(await sign({ secret: OTHER_SECRET }), "wrong secret");
});

Deno.test("wrong issuer or audience is rejected", async () => {
  await assertRejected(await sign({ issuer: "someone-else" }), "wrong issuer");
  await assertRejected(await sign({ audience: "another-service" }), "wrong audience");
});

Deno.test("only HS256 is accepted: other algorithms and unsigned tokens are rejected", async () => {
  await assertRejected(await sign({ alg: "HS512" }), "HS512");
  const unsigned = new UnsecuredJWT({ project_id: PROJECT_A, user_id: USER_A, tenant_id: TENANT_A, scope: "full_export" })
    .setIssuer(EXPORT_TOKEN_ISSUER)
    .setAudience(EXPORT_TOKEN_AUDIENCE)
    .setExpirationTime("5m")
    .encode();
  await assertRejected(unsigned, "alg none");
});

Deno.test("cross-tenant forgery: a valid token whose payload is swapped to another tenant is rejected", async () => {
  const token = await sign(); // genuine token for tenant A
  const [header, , signature] = token.split(".");
  const forgedPayload = btoa(JSON.stringify({
    project_id: PROJECT_B,
    user_id: USER_A,
    tenant_id: TENANT_B,
    scope: "full_export",
    iss: EXPORT_TOKEN_ISSUER,
    aud: EXPORT_TOKEN_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + 300,
  })).replace(/=+$/, "").replaceAll("+", "-").replaceAll("/", "_");
  await assertRejected(`${header}.${forgedPayload}.${signature}`, "swapped payload");
});

Deno.test("malformed or empty tokens are rejected", async () => {
  await assertRejected("not-a-token", "garbage");
  await assertRejected("a.b.c", "three segments");
  await assertRejected("", "empty");
});

Deno.test("isTokenVerificationError does not swallow ordinary failures", () => {
  assertFalse(isTokenVerificationError(new Error("database exploded")));
  assertFalse(isTokenVerificationError(new TypeError("fetch failed")));
  assertFalse(isTokenVerificationError(null));
  assertFalse(isTokenVerificationError({ code: "ECONNRESET" }));
});

// --- Claims: scope, project and ids ----------------------------------------------------------

Deno.test("each endpoint accepts only its own scopes", () => {
  const claims = (scope: string) => ({ project_id: PROJECT_A, tenant_id: TENANT_A, user_id: USER_A, scope });
  assert(parseExportClaims(claims("documents_export"), { allowedScopes: WORKER_SCOPES }).ok);
  assert(parseExportClaims(claims("full_export"), { allowedScopes: WORKER_SCOPES }).ok);
  assert(parseExportClaims(claims("full_export"), { allowedScopes: XLSX_SCOPES }).ok);
  // A documents-only token can never read the expenses spreadsheet, and vice versa
  for (const [scope, allowed] of [["documents_export", XLSX_SCOPES], ["expenses_export", WORKER_SCOPES], ["admin", WORKER_SCOPES]] as const) {
    const result = parseExportClaims(claims(scope), { allowedScopes: allowed });
    assert(!result.ok);
    assertEquals([result.status, result.error], [403, "INVALID_SCOPE"]);
  }
  const missing = parseExportClaims({ project_id: PROJECT_A, tenant_id: TENANT_A, user_id: USER_A }, { allowedScopes: WORKER_SCOPES });
  assert(!missing.ok && missing.error === "INVALID_SCOPE");
});

Deno.test("a token is bound to its project: another project_id in the request is refused", () => {
  const payload = { project_id: PROJECT_A, tenant_id: TENANT_A, user_id: USER_A, scope: "full_export" };
  assert(parseExportClaims(payload, { allowedScopes: XLSX_SCOPES, projectId: PROJECT_A }).ok);
  const crossProject = parseExportClaims(payload, { allowedScopes: XLSX_SCOPES, projectId: PROJECT_B });
  assert(!crossProject.ok);
  assertEquals([crossProject.status, crossProject.error], [403, "PROJECT_MISMATCH"]);
});

Deno.test("claims that are missing or not UUIDs are refused (they become database filters)", () => {
  const good = { project_id: PROJECT_A, tenant_id: TENANT_A, user_id: USER_A, scope: "documents_export" };
  for (const bad of [
    { ...good, tenant_id: undefined },
    { ...good, tenant_id: "tenant-a" },
    { ...good, tenant_id: `${TENANT_A},or=(id.neq.0)` },
    { ...good, project_id: 42 },
    { ...good, user_id: null },
    { ...good, project_id: "" },
  ]) {
    const result = parseExportClaims(bad as Record<string, unknown>, { allowedScopes: WORKER_SCOPES });
    assert(!result.ok);
    assertEquals([result.status, result.error], [401, "INVALID_TOKEN"]);
  }
});

// --- Requesting a token: plan, project and tenant --------------------------------------------

const PROJECT_ROW = { id: PROJECT_A, tenant_id: TENANT_A };

Deno.test("only explicit paid plans may export (fail closed)", () => {
  assert(isPaidPlan("pro") && isPaidPlan("premium"));
  for (const plan of ["free", "", "trial", "PRO", null, undefined, 1]) assertFalse(isPaidPlan(plan));
});

Deno.test("free plan, unknown plan and unreadable plan are refused with 403", () => {
  for (const plan of ["free", "trial", null, undefined]) {
    const decision = decideExport({ exportType: "documents", plan, project: PROJECT_ROW });
    assert(!decision.ok);
    assertEquals([decision.status, decision.error], [403, "FORBIDDEN"]);
  }
});

Deno.test("a project the caller cannot see (another tenant, or missing) is refused identically", () => {
  // RLS returns no row for a project of another tenant: same answer as a project that does not exist
  const crossTenant = decideExport({ exportType: "documents", plan: "pro", project: null });
  const missing = decideExport({ exportType: "full", plan: "pro", project: undefined });
  assert(!crossTenant.ok && !missing.ok);
  assertEquals([crossTenant.status, crossTenant.error, crossTenant.reason], [403, "FORBIDDEN", "Project not found or access denied"]);
  assertEquals(crossTenant.reason, missing.reason);
  assert(!decideExport({ exportType: "documents", plan: "pro", project: { id: "x", tenant_id: TENANT_A } }).ok);
});

Deno.test("export_type is validated and defaults to documents", () => {
  assertEquals(parseExportType(undefined), "documents");
  assertEquals(parseExportType("full"), "full");
  for (const bad of ["expenses", "FULL", 1, {}, ["full"]]) assertEquals(parseExportType(bad), null);
  const decision = decideExport({ exportType: "everything", plan: "pro", project: PROJECT_ROW });
  assert(!decision.ok);
  assertEquals([decision.status, decision.error], [400, "INVALID_REQUEST"]);
});

Deno.test("an authorised export gets the scope of its type and the tenant of the project row", () => {
  const documents = decideExport({ exportType: undefined, plan: "pro", project: PROJECT_ROW });
  const full = decideExport({ exportType: "full", plan: "premium", project: PROJECT_ROW });
  assert(documents.ok && full.ok);
  assertEquals([documents.scope, documents.tenantId], ["documents_export", TENANT_A]);
  assertEquals([full.scope, full.tenantId], ["full_export", TENANT_A]);
});
