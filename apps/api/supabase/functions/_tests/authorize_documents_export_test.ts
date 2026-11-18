// Run from apps/api/supabase/functions:
//   deno test --no-lock --allow-env --allow-read=.. --import-map=_tests/import_map.json _tests/
//
// Tests the REAL handler of authorize-project-documents-export, the only place export tokens are
// issued (the import map only swaps the HTTP server for a test double). Supabase Auth and PostgREST
// are stubbed through fetch, and every database request is recorded with the credential it carried.
//
// Proven here:
//   - tokens are HS256, issuer visao-clara-edge, audience visao-clara-worker, valid exactly 300 s;
//   - scope documents_export / full_export follows export_type;
//   - tenant_id comes from the project row read under RLS, never from the request;
//   - plan and project are read with the caller's own token (RLS), never the service role;
//   - free plan -> 403; pro/premium + visible project -> token; pro/premium + invisible project -> 403;
//   - missing/invalid authentication -> 401 before any database access;
//   - unexpected failures fail closed (no token) and expose nothing sensitive.
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { decodeProtectedHeader, jwtVerify } from "https://esm.sh/jose@5.1.0";
import { EXPORT_VERIFY_OPTIONS } from "../_shared/export_access.ts";

type Handler = (req: Request) => Promise<Response>;
await import("../authorize-project-documents-export/index.ts");
const handler = (globalThis as unknown as { __handler: Handler }).__handler;

const SUPABASE_URL = "http://supabase.test";
const ANON_KEY = "anon-key-for-tests";
const SERVICE_KEY = "service-role-key-MUST-NOT-BE-USED";
const SECRET = "authorize-test-export-secret-0123456789";
const USER_TOKEN = "valid-user-token";

const USER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

interface DbRequest {
  table: string;
  authorization: string | null;
  apikey: string | null;
}

interface Backend {
  /** The caller's plan; null = no profile row visible */
  plan?: string | null;
  /** Projects visible to the caller under RLS */
  visibleProjects?: Array<{ id: string; tenant_id: string }>;
  /** Make a table answer with a database error */
  failTable?: "profiles" | "projects";
  env?: Record<string, string | undefined>;
}

interface Harness {
  db: DbRequest[];
  authCalls: string[];
  allAuthHeaders: string[];
  logs: string[];
  restore(): void;
}

function setup(backend: Backend = {}): Harness {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const db: DbRequest[] = [];
  const authCalls: string[] = [];
  const allAuthHeaders: string[] = [];
  const logs: string[] = [];
  console.error = (...args: unknown[]) => {
    logs.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack ?? ""}` : String(a))).join(" "));
  };

  const env: Record<string, string | undefined> = {
    VC_SUPABASE_URL: SUPABASE_URL,
    VC_SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    EXPORT_JWT_SECRET: SECRET,
    ...backend.env,
  };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    allAuthHeaders.push(`${headers.get("Authorization") ?? ""} ${headers.get("apikey") ?? ""}`);
    if (url.origin !== SUPABASE_URL) throw new Error(`unexpected outbound request to ${url.origin}`);

    if (url.pathname === "/auth/v1/user") {
      authCalls.push(headers.get("Authorization") ?? "");
      return Promise.resolve(headers.get("Authorization") === `Bearer ${USER_TOKEN}`
        ? json({ id: USER_A, aud: "authenticated", email: "a@example.test" })
        : json({ code: 401, msg: "invalid JWT" }, 401));
    }

    const table = url.pathname.replace("/rest/v1/", "");
    db.push({ table, authorization: headers.get("Authorization"), apikey: headers.get("apikey") });
    const single = (headers.get("Accept") ?? "").includes("vnd.pgrst.object");
    const answer = (row: unknown) => (single ? (row ? json(row) : json({ code: "PGRST116", message: "no rows" }, 406)) : json(row ? [row] : []));

    if (backend.failTable === table) return Promise.resolve(json({ code: "XX000", message: "database exploded" }, 500));
    if (table === "profiles") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      return Promise.resolve(answer(backend.plan != null && id === USER_A ? { plan: backend.plan } : null));
    }
    if (table === "projects") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      return Promise.resolve(answer((backend.visibleProjects ?? []).find((p) => p.id === id) ?? null));
    }
    throw new Error(`unexpected request ${url.pathname}`);
  };

  return {
    db,
    authCalls,
    allAuthHeaders,
    logs,
    restore: () => {
      globalThis.fetch = realFetch;
      console.error = realError;
    },
  };
}

function post(body: unknown, auth: "user" | "none" | "invalid" = "user", method = "POST"): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ANON_KEY}`, // what the frontend sends: the gateway checks the anon key
    apikey: ANON_KEY,
  };
  if (auth === "user") headers["x-user-jwt"] = USER_TOKEN;
  if (auth === "invalid") headers["x-user-jwt"] = "expired-or-forged";
  if (auth === "none") {
    delete headers.Authorization;
    delete headers.apikey;
  }
  return handler(new Request("http://localhost/functions/v1/authorize-project-documents-export", {
    method,
    headers,
    body: method === "GET" || method === "OPTIONS" ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  }));
}

async function issuedToken(res: Response) {
  assertEquals(res.status, 200, "status");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.expires_in, 300);
  const token = body.export_token as string;
  const { payload, protectedHeader } = await jwtVerify(token, new TextEncoder().encode(SECRET), EXPORT_VERIFY_OPTIONS);
  return { token, payload, protectedHeader };
}

async function assertRefused(res: Response, status: number, error: string, label: string) {
  assertEquals(res.status, status, `${label}: status`);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*", `${label}: CORS`);
  const text = await res.text();
  assertFalse(text.includes("export_token"), `${label}: no token may be issued`);
  assertFalse(text.includes("eyJ"), `${label}: no JWT in the response`);
  if (error) assertEquals(JSON.parse(text).error, error, `${label}: error code`);
}

const VISIBLE_A = [{ id: PROJECT_A, tenant_id: TENANT_A }];

// --- Token format -----------------------------------------------------------------------------

Deno.test("issued token: HS256, issuer, audience, and valid for exactly 300 seconds", async () => {
  const h = setup({ plan: "pro", visibleProjects: VISIBLE_A });
  try {
    const { token, payload, protectedHeader } = await issuedToken(await post({ project_id: PROJECT_A }));
    assertEquals(protectedHeader.alg, "HS256");
    assertEquals(decodeProtectedHeader(token).alg, "HS256");
    assertEquals(payload.iss, "visao-clara-edge");
    assertEquals(payload.aud, "visao-clara-worker");
    assert(typeof payload.iat === "number" && typeof payload.exp === "number");
    assertEquals(payload.exp! - payload.iat!, 300, "lifetime");
    assert(Math.abs(payload.iat! - Math.floor(Date.now() / 1000)) <= 5, "issued now");
    // Verifies with the shared options only with the right secret
    let rejected = false;
    try {
      await jwtVerify(token, new TextEncoder().encode("another-secret-0123456789abcdef"), EXPORT_VERIFY_OPTIONS);
    } catch {
      rejected = true;
    }
    assert(rejected, "a token verifies only with the configured secret");
  } finally {
    h.restore();
  }
});

Deno.test("scope follows export_type: documents (default or explicit) -> documents_export, full -> full_export", async () => {
  for (const [exportType, scope] of [[undefined, "documents_export"], ["documents", "documents_export"], ["full", "full_export"]] as const) {
    const h = setup({ plan: "pro", visibleProjects: VISIBLE_A });
    try {
      const body: Record<string, unknown> = { project_id: PROJECT_A };
      if (exportType) body.export_type = exportType;
      const { payload } = await issuedToken(await post(body));
      assertEquals(payload.scope, scope, `export_type ${exportType}`);
    } finally {
      h.restore();
    }
  }
});

Deno.test("an unknown export_type is refused (400) and no token is issued", async () => {
  for (const exportType of ["expenses", "FULL", "admin", 1]) {
    const h = setup({ plan: "pro", visibleProjects: VISIBLE_A });
    try {
      await assertRefused(await post({ project_id: PROJECT_A, export_type: exportType }), 400, "INVALID_REQUEST", `export_type ${exportType}`);
    } finally {
      h.restore();
    }
  }
});

// --- Tenant, user and project come from the server ---------------------------------------------

Deno.test("tenant_id comes from the project row; tenant_id, user_id or scope in the request are ignored", async () => {
  const h = setup({ plan: "pro", visibleProjects: VISIBLE_A });
  try {
    const { payload } = await issuedToken(await post({
      project_id: PROJECT_A,
      tenant_id: TENANT_B,
      user_id: "99999999-9999-4999-8999-999999999999",
      scope: "full_export",
    }));
    assertEquals(payload.tenant_id, TENANT_A, "tenant of the project row");
    assertEquals(payload.user_id, USER_A, "the authenticated user");
    assertEquals(payload.project_id, PROJECT_A);
    assertEquals(payload.scope, "documents_export", "scope only from export_type");
  } finally {
    h.restore();
  }
});

Deno.test("plan and project are read with the caller's own token (RLS), never the service role", async () => {
  const h = setup({ plan: "premium", visibleProjects: VISIBLE_A });
  try {
    await issuedToken(await post({ project_id: PROJECT_A, export_type: "full" }));
    assertEquals(h.db.map((r) => r.table).sort(), ["profiles", "projects"]);
    for (const r of h.db) {
      assertEquals(r.authorization, `Bearer ${USER_TOKEN}`, `${r.table}: user's token`);
      assertEquals(r.apikey, ANON_KEY, `${r.table}: anon key`);
    }
    assertFalse(h.allAuthHeaders.some((v) => v.includes(SERVICE_KEY)), "service role key never sent");
  } finally {
    h.restore();
  }
});

// --- Plans and project access ------------------------------------------------------------------

Deno.test("pro and premium users get a token for a project they can see", async () => {
  for (const plan of ["pro", "premium"]) {
    const h = setup({ plan, visibleProjects: VISIBLE_A });
    try {
      const { payload } = await issuedToken(await post({ project_id: PROJECT_A }));
      assertEquals(payload.project_id, PROJECT_A, plan);
    } finally {
      h.restore();
    }
  }
});

Deno.test("free plan, unknown plan and missing profile are refused with 403", async () => {
  for (const plan of ["free", "trial", "", null]) {
    const h = setup({ plan, visibleProjects: VISIBLE_A });
    try {
      await assertRefused(await post({ project_id: PROJECT_A }), 403, "FORBIDDEN", `plan ${plan}`);
    } finally {
      h.restore();
    }
  }
});

Deno.test("pro/premium without access to the project (another tenant, or missing) are refused identically with 403", async () => {
  const reasons: string[] = [];
  for (const plan of ["pro", "premium"]) {
    for (const projectId of [PROJECT_B, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"]) {
      // RLS hides PROJECT_B (another tenant): only PROJECT_A is visible to this user
      const h = setup({ plan, visibleProjects: VISIBLE_A });
      try {
        const res = await post({ project_id: projectId });
        assertEquals(res.status, 403, `${plan} ${projectId}`);
        const body = await res.json();
        assertEquals(body.error, "FORBIDDEN");
        assertFalse("export_token" in body);
        reasons.push(body.reason);
      } finally {
        h.restore();
      }
    }
  }
  assertEquals(new Set(reasons).size, 1, "another tenant's project and a missing project are indistinguishable");
});

Deno.test("missing or invalid project_id and unreadable bodies are refused with 400", async () => {
  const h = setup({ plan: "pro", visibleProjects: VISIBLE_A });
  try {
    await assertRefused(await post({}), 400, "INVALID_REQUEST", "no project_id");
    await assertRefused(await post({ project_id: 42 }), 400, "INVALID_REQUEST", "numeric project_id");
    await assertRefused(await post("{not json"), 400, "INVALID_REQUEST", "invalid JSON");
  } finally {
    h.restore();
  }
});

// --- Authentication ----------------------------------------------------------------------------

Deno.test("missing or invalid authentication -> 401 before any database access", async () => {
  for (const auth of ["none", "invalid"] as const) {
    const h = setup({ plan: "pro", visibleProjects: VISIBLE_A });
    try {
      const res = await post({ project_id: PROJECT_A }, auth);
      await assertRefused(res, 401, "UNAUTHORIZED", `auth ${auth}`);
      assertEquals(h.db, [], `auth ${auth}: no database access`);
    } finally {
      h.restore();
    }
  }
});

Deno.test("only POST issues tokens; OPTIONS answers the preflight without authentication or database access", async () => {
  const h = setup({ plan: "pro", visibleProjects: VISIBLE_A });
  try {
    const preflight = await post(undefined, "none", "OPTIONS");
    assertEquals(preflight.status, 200);
    assertEquals(preflight.headers.get("Access-Control-Allow-Origin"), "*");
    await preflight.body?.cancel();
    for (const method of ["GET", "PUT", "DELETE"]) {
      await assertRefused(await post({ project_id: PROJECT_A }, "user", method), 405, "METHOD_NOT_ALLOWED", method);
    }
    assertEquals(h.db, []);
    assertEquals(h.authCalls, []);
  } finally {
    h.restore();
  }
});

// --- Fail closed -------------------------------------------------------------------------------

Deno.test("database errors fail closed: 403 and no token, whichever query fails", async () => {
  for (const failTable of ["profiles", "projects"] as const) {
    const h = setup({ plan: "pro", visibleProjects: VISIBLE_A, failTable });
    try {
      const res = await post({ project_id: PROJECT_A });
      await assertRefused(res, 403, "FORBIDDEN", `${failTable} error`);
    } finally {
      h.restore();
    }
  }
});

Deno.test("missing, empty or whitespace-only EXPORT_JWT_SECRET: generic 500, no token, nothing sensitive in the response", async () => {
  for (const secret of [undefined, "", "   ", "\t\n "]) {
    const h = setup({ plan: "pro", visibleProjects: VISIBLE_A, env: { EXPORT_JWT_SECRET: secret } });
    try {
      const res = await post({ project_id: PROJECT_A });
      assertEquals(res.status, 500);
      assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
      const text = await res.text();
      assertEquals(JSON.parse(text), { error: "INTERNAL_ERROR", reason: "Unexpected server error" });
      for (const leak of ["EXPORT_JWT_SECRET", "Missing env", "at ", USER_TOKEN, SERVICE_KEY, TENANT_A]) {
        assertFalse(text.includes(leak), `response must not contain ${leak}`);
      }
    } finally {
      h.restore();
    }
  }
});

Deno.test("the export secret and the user's token never appear in logs, even on errors", async () => {
  const scenarios: Backend[] = [
    { plan: "pro", visibleProjects: VISIBLE_A },
    { plan: "free", visibleProjects: VISIBLE_A },
    { plan: "pro", visibleProjects: [] },
    { plan: "pro", visibleProjects: VISIBLE_A, failTable: "projects" },
    { plan: "pro", visibleProjects: VISIBLE_A, env: { EXPORT_JWT_SECRET: undefined } },
    { plan: "pro", visibleProjects: VISIBLE_A, env: { EXPORT_JWT_SECRET: "   " } },
  ];
  for (const backend of scenarios) {
    const h = setup(backend);
    try {
      const res = await post({ project_id: PROJECT_A });
      await res.body?.cancel();
    } finally {
      h.restore();
    }
    assertFalse(h.logs.some((l) => l.includes(SECRET)), "secret in logs");
    assertFalse(h.logs.some((l) => l.includes(USER_TOKEN)), "user token in logs");
  }
});
