// Run from apps/api/supabase/functions:
//   deno test --no-lock --allow-env --allow-read=.. --import-map=_tests/import_map.json _tests/
//
// Tests the REAL handler of get-project-expenses-xlsx (the import map only replaces the HTTP server
// and exceljs with test doubles). This function runs with verify_jwt = false, so the Edge gateway
// does not authenticate anything: every guarantee below comes from the function's own code.
//   - every request needs a valid, signed, unexpired export token of the right issuer, audience,
//     algorithm (HS256 only) and scope, bound to the requested project;
//   - nothing is read from the database before the token is accepted;
//   - only the token's tenant and project are exported;
//   - missing configuration fails closed (500, no data).
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { SignJWT, UnsecuredJWT } from "https://esm.sh/jose@5.1.0";

await import("../get-project-expenses-xlsx/index.ts"); // registers the handler through the stubbed serve()
const handler = (globalThis as unknown as { __handler: (req: Request) => Promise<Response> }).__handler;

const SUPABASE_URL = "http://supabase.test";
const SECRET = "xlsx-test-export-secret-0123456789ab";
const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const EXPENSES = [
  { id: "e1", tenant_id: TENANT_A, project_id: PROJECT_A, title: "Tijolo A", description: "Tijolo A", amount_cents: 12345, supplier_name: "Forn A", category: "Materiais", expense_date: "2026-01-02", warranty_expires_at: null },
  { id: "e2", tenant_id: TENANT_B, project_id: PROJECT_B, title: "Segredo B", description: "Segredo B", amount_cents: 99900, supplier_name: "Forn B", category: "Mão de obra", expense_date: "2026-01-03", warranty_expires_at: null },
];

interface Harness {
  dbRequests: string[];
  restore(): void;
}

/** Stubs the database REST layer (honours eq filters) and sets the function's configuration. */
function setup(env: Record<string, string | undefined> = {}): Harness {
  const realFetch = globalThis.fetch;
  const dbRequests: string[] = [];
  (globalThis as unknown as { __xlsxRows: unknown[] }).__xlsxRows = [];

  globalThis.fetch = (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== SUPABASE_URL) throw new Error(`unexpected outbound request to ${url.origin}`);
    dbRequests.push(url.pathname + url.search);
    let rows = EXPENSES as Array<Record<string, unknown>>;
    for (const [col, raw] of url.searchParams) {
      if (raw.startsWith("eq.")) rows = rows.filter((r) => String(r[col]) === raw.slice(3));
    }
    return Promise.resolve(new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } }));
  };

  const full: Record<string, string | undefined> = {
    EXPORT_JWT_SECRET: SECRET,
    VC_SUPABASE_URL: SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-tests",
    ...env,
  };
  for (const [k, v] of Object.entries(full)) {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }

  return { dbRequests, restore: () => { globalThis.fetch = realFetch; } };
}

const exportedRows = () => (globalThis as unknown as { __xlsxRows: Array<Record<string, unknown>> }).__xlsxRows;

interface TokenOptions {
  secret?: string;
  alg?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: number;
  claims?: Record<string, unknown>;
}

function token(opts: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ project_id: PROJECT_A, user_id: USER_A, tenant_id: TENANT_A, scope: "full_export", ...opts.claims })
    .setProtectedHeader({ alg: opts.alg ?? "HS256" })
    .setIssuedAt(now - 600)
    .setIssuer(opts.issuer ?? "visao-clara-edge")
    .setAudience(opts.audience ?? "visao-clara-worker")
    .setExpirationTime(now + (opts.expiresIn ?? 300))
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

function get(tok?: string | null, project: string | null = PROJECT_A, headers: HeadersInit = {}, method = "GET"): Promise<Response> {
  const url = new URL("http://localhost/functions/v1/get-project-expenses-xlsx");
  if (tok) url.searchParams.set("token", tok);
  if (project) url.searchParams.set("project_id", project);
  return handler(new Request(url, { method, headers }));
}

async function assertRefused(res: Response, status: number, error: string, h: Harness, label: string, tok?: string) {
  assertEquals(res.status, status, `${label}: status`);
  const text = await res.text();
  assertEquals(JSON.parse(text).error, error, `${label}: error code`);
  assertEquals(h.dbRequests, [], `${label}: the database must not be queried`);
  assertEquals(exportedRows(), [], `${label}: nothing may be exported`);
  if (tok) assertFalse(text.includes(tok), `${label}: the response must not echo the token`);
}

// --- Every request needs a valid token -----------------------------------------------------------

Deno.test("no token, or no project -> 400, nothing read", async () => {
  const h = setup();
  try {
    await assertRefused(await get(null), 400, "MISSING_TOKEN", h, "no token");
    await assertRefused(await get(await token(), null), 400, "MISSING_PROJECT_ID", h, "no project");
  } finally {
    h.restore();
  }
});

Deno.test("it is not an unauthenticated endpoint: Authorization, apikey or a user JWT never replace the export token", async () => {
  const h = setup();
  try {
    const userJwt = await token({ secret: "the-supabase-auth-secret-0123456789ab", claims: { role: "authenticated", scope: undefined } });
    const attempts: Record<string, string>[] = [
      { Authorization: `Bearer ${userJwt}` },
      { Authorization: "Bearer anon-key-is-public", apikey: "anon-key-is-public" },
      { "x-user-jwt": userJwt },
    ];
    for (const headers of attempts) {
      await assertRefused(await get(null, PROJECT_A, headers), 400, "MISSING_TOKEN", h, `headers ${Object.keys(headers)}`);
    }
    // ... and a user JWT passed AS the export token is refused too (wrong secret)
    await assertRefused(await get(userJwt), 401, "INVALID_TOKEN", h, "user JWT as export token", userJwt);
  } finally {
    h.restore();
  }
});

Deno.test("forged, expired, tampered and malformed tokens -> 401 INVALID_TOKEN, nothing read", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cases: Record<string, () => Promise<string>> = {
    "signed with another secret": () => token({ secret: "attacker-secret-0123456789abcdefghijk" }),
    "expired": () => token({ expiresIn: -30 }),
    "wrong issuer": () => token({ issuer: "attacker" }),
    "wrong audience": () => token({ audience: "some-other-service" }),
    "HS512 instead of HS256": () => token({ alg: "HS512" }),
    "alg none": () =>
      Promise.resolve(
        new UnsecuredJWT({ project_id: PROJECT_A, user_id: USER_A, tenant_id: TENANT_A, scope: "full_export" })
          .setIssuer("visao-clara-edge").setAudience("visao-clara-worker").setExpirationTime(now + 300).encode(),
      ),
    "tenant swapped, signature kept": async () => {
      const [header, , signature] = (await token()).split(".");
      const payload = btoa(JSON.stringify({
        project_id: PROJECT_B, user_id: USER_A, tenant_id: TENANT_B, scope: "full_export",
        iss: "visao-clara-edge", aud: "visao-clara-worker", exp: now + 300,
      })).replace(/=+$/, "").replaceAll("+", "-").replaceAll("/", "_");
      return `${header}.${payload}.${signature}`;
    },
    "garbage": () => Promise.resolve("not-a-token"),
    "claims that are not UUIDs": () => token({ claims: { tenant_id: "tenant-a" } }),
    "missing user claim": () => token({ claims: { user_id: undefined } }),
  };
  for (const [label, make] of Object.entries(cases)) {
    const h = setup();
    try {
      const tok = await make();
      await assertRefused(await get(tok), 401, "INVALID_TOKEN", h, label, tok);
    } finally {
      h.restore();
    }
  }
});

Deno.test("wrong-scope tokens -> 403 INVALID_SCOPE (a documents-only token cannot read expenses)", async () => {
  for (const scope of ["documents_export", "admin", "", undefined]) {
    const h = setup();
    try {
      await assertRefused(await get(await token({ claims: { scope } })), 403, "INVALID_SCOPE", h, `scope ${scope}`);
    } finally {
      h.restore();
    }
  }
});

Deno.test("a token is bound to its project: another project_id -> 403 PROJECT_MISMATCH, nothing read", async () => {
  const h = setup();
  try {
    await assertRefused(await get(await token(), PROJECT_B), 403, "PROJECT_MISMATCH", h, "token for A, request for B");
  } finally {
    h.restore();
  }
});

// --- Tenant isolation ----------------------------------------------------------------------------

Deno.test("a valid token exports only its own tenant and project, filtered by the token's ids", async () => {
  for (const scope of ["full_export", "expenses_export"]) {
    const h = setup();
    try {
      const res = await get(await token({ claims: { scope } }));
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await res.arrayBuffer();

      assertEquals(h.dbRequests.length, 1);
      const q = new URLSearchParams(h.dbRequests[0].split("?")[1]);
      assertEquals(q.get("tenant_id"), `eq.${TENANT_A}`);
      assertEquals(q.get("project_id"), `eq.${PROJECT_A}`);

      const rows = exportedRows().filter((r) => r.description !== "TOTAL");
      assertEquals(rows.map((r) => r.description), ["Tijolo A"]);
      assertFalse(JSON.stringify(exportedRows()).includes("Segredo B"), "the other tenant's expense must not be exported");
    } finally {
      h.restore();
    }
  }
});

Deno.test("a token pairing tenant A with project B exports nothing of tenant B", async () => {
  const h = setup();
  try {
    const res = await get(await token({ claims: { project_id: PROJECT_B } }), PROJECT_B);
    assertEquals(res.status, 200);
    await res.arrayBuffer();
    assertEquals(exportedRows(), [], "no rows: project B does not belong to tenant A");
    assertFalse(JSON.stringify(exportedRows()).includes("Segredo B"));
  } finally {
    h.restore();
  }
});

// --- Fail closed ---------------------------------------------------------------------------------

Deno.test("missing, empty or whitespace-only EXPORT_JWT_SECRET fails closed: 500, no data, even with a plausible token", async () => {
  for (const secret of [undefined, "", "   ", "\t\n "]) {
    const h = setup({ EXPORT_JWT_SECRET: secret });
    try {
      const res = await get(await token());
      assertEquals(res.status, 500);
      assertEquals((await res.json()).error, "INTERNAL_ERROR");
      assertEquals(h.dbRequests, []);
      assertEquals(exportedRows(), []);
    } finally {
      h.restore();
    }
  }
});

Deno.test("an unset secret cannot be satisfied by a token signed with an empty or default key", async () => {
  const h = setup({ EXPORT_JWT_SECRET: undefined });
  try {
    for (const secret of ["", "secret", "undefined"]) {
      let tok: string;
      try {
        tok = await token({ secret });
      } catch {
        continue; // jose refuses to sign with an empty key at all
      }
      const res = await get(tok);
      assert(res.status >= 400, "must not succeed");
      await res.arrayBuffer();
    }
    assertEquals(h.dbRequests, []);
    assertEquals(exportedRows(), []);
  } finally {
    h.restore();
  }
});

Deno.test("missing database configuration fails closed after a valid token: 500, nothing exported", async () => {
  for (const missing of ["VC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const h = setup({ [missing]: undefined });
    try {
      const res = await get(await token());
      assertEquals(res.status, 500);
      await res.arrayBuffer();
      assertEquals(h.dbRequests, []);
      assertEquals(exportedRows(), []);
    } finally {
      h.restore();
    }
  }
});

Deno.test("a database error is a 500 and exports nothing", async () => {
  const h = setup();
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ message: "boom" }), { status: 500, headers: { "Content-Type": "application/json" } }));
  try {
    const res = await get(await token());
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error, "INTERNAL_ERROR");
    assertEquals(exportedRows(), []);
  } finally {
    h.restore();
  }
});

// --- Methods -------------------------------------------------------------------------------------

Deno.test("only GET returns data; OPTIONS answers the preflight without touching the database", async () => {
  const h = setup();
  try {
    const preflight = await get(await token(), PROJECT_A, {}, "OPTIONS");
    assertEquals(preflight.status, 200);
    assertEquals(await preflight.text(), "");
    for (const method of ["POST", "PUT", "DELETE", "PATCH", "HEAD"]) {
      const res = await get(await token(), PROJECT_A, {}, method);
      assertEquals(res.status, 405, method);
      await res.arrayBuffer();
    }
    assertEquals(h.dbRequests, []);
    assertEquals(exportedRows(), []);
  } finally {
    h.restore();
  }
});

Deno.test("a whitespace-only EXPORT_JWT_SECRET cannot be satisfied by a token signed with that whitespace", async () => {
  for (const blank of ["   ", "\t\n "]) {
    const h = setup({ EXPORT_JWT_SECRET: blank });
    try {
      // An attacker who guesses a blank secret can sign a perfectly well-formed token with it
      const res = await get(await token({ secret: blank }));
      assertEquals(res.status, 500, "refused as misconfiguration");
      const text = await res.text();
      assertEquals(JSON.parse(text).error, "INTERNAL_ERROR");
      assertFalse(text.includes("EXPORT_JWT_SECRET"), "variable name not exposed in the response");
      assertEquals(h.dbRequests, [], "nothing read");
      assertEquals(exportedRows(), [], "nothing exported");
    } finally {
      h.restore();
    }
  }
});
