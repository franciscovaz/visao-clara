// Run from apps/api/cloudflare-workers/export-documents-worker:
//   deno test --no-check --no-lock --allow-env test/
//
// Runs the REAL Worker code (src/index.ts) against an in-memory Supabase REST table and a mock R2
// binding: no network, no cloud resources. Deno is only the test runner; --no-check because the
// Worker is typed against @cloudflare/workers-types (R2Bucket), which Deno does not load.
//
// What is proven:
//   - invalid, expired, forged, wrong-scope and malformed tokens are refused (401/403/400) and
//     NOTHING is read from the database or from storage;
//   - the files served are only those of the token's tenant and project (cross-tenant);
//   - rows or keys that are inconsistent fail closed (409) before any byte is served;
//   - the ZIP really contains the documents and, for a full export, the spreadsheet;
//   - a failing spreadsheet hop (e.g. the Edge gateway refusing the call) fails the export (502).
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { SignJWT, UnsecuredJWT } from "jose";
import { Uint8ArrayReader, ZipReader, TextWriter } from "@zip.js/zip.js";
import worker from "../src/index.ts";
import { buildObjectKey } from "../../../supabase/functions/_shared/storage_identity.ts";

const SUPABASE_URL = "https://stub-project.supabase.test";
const BUCKET = "stub-private-bucket";
const SECRET = "test-export-secret-0123456789abcdef";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

interface Row {
  id: string;
  tenant_id: string;
  project_id: string;
  document_id: string;
  file_name: string;
  storage_provider: string;
  storage_bucket: string;
  storage_key: string;
  r2_bucket: string;
  r2_key: string;
  status: string;
}

let counter = 0;
function uuid(): string {
  counter++;
  const hex = counter.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

/** A document_files row whose storage identity is valid for its own tenant/project. */
function makeRow(tenant: string, project: string, fileName: string, overrides: Partial<Row> = {}): Row {
  const ids = { tenant_id: tenant, project_id: project, document_id: uuid(), id: uuid() };
  const key = buildObjectKey(ids, fileName)!;
  return {
    ...ids,
    file_name: fileName,
    storage_provider: "r2",
    storage_bucket: BUCKET,
    storage_key: key,
    r2_bucket: BUCKET,
    r2_key: key,
    status: "uploaded",
    ...overrides,
  };
}

interface Harness {
  env: Record<string, unknown>;
  dbRequests: string[];
  xlsxRequests: string[];
  r2Reads: string[]; // head + get
  restore(): void;
}

interface HarnessOptions {
  rows: Row[];
  /** Ignore the query filters and always return these rows (simulates a buggy/compromised filter) */
  ignoreFilters?: boolean;
  objects?: Record<string, string>;
  xlsx?: { status: number; body?: string };
}

function setup(opts: HarnessOptions): Harness {
  const realFetch = globalThis.fetch;
  const dbRequests: string[] = [];
  const xlsxRequests: string[] = [];
  const r2Reads: string[] = [];

  globalThis.fetch = (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== SUPABASE_URL) throw new Error(`unexpected outbound request to ${url.origin}`);

    if (url.pathname === "/rest/v1/document_files") {
      dbRequests.push(url.search);
      let rows = opts.rows;
      if (!opts.ignoreFilters) {
        // PostgREST equality filters (?col=eq.value)
        for (const [col, raw] of url.searchParams) {
          if (raw.startsWith("eq.")) rows = rows.filter((r) => String((r as unknown as Record<string, unknown>)[col]) === raw.slice(3));
        }
      }
      return Promise.resolve(new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } }));
    }

    if (url.pathname === "/functions/v1/get-project-expenses-xlsx") {
      xlsxRequests.push(url.search);
      const x = opts.xlsx ?? { status: 200, body: "XLSX-BYTES" };
      return Promise.resolve(new Response(x.body ?? "", { status: x.status }));
    }

    throw new Error(`unexpected request ${url.pathname}`);
  };

  const objects = opts.objects ?? Object.fromEntries(opts.rows.map((r) => [r.storage_key, `content of ${r.file_name}`]));
  const r2 = {
    head(key: string) {
      r2Reads.push(`head ${key}`);
      return Promise.resolve(key in objects ? {} : null);
    },
    get(key: string) {
      r2Reads.push(`get ${key}`);
      if (!(key in objects)) return Promise.resolve(null);
      return Promise.resolve({ body: new Response(objects[key]).body });
    },
  };

  return {
    env: {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-role-key",
      EXPORT_JWT_SECRET: SECRET,
      STORAGE_PROVIDER: "r2",
      R2_BUCKET: r2,
      R2_BUCKET_NAME: BUCKET,
    },
    dbRequests,
    xlsxRequests,
    r2Reads,
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}

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
  return new SignJWT({ project_id: PROJECT_A, user_id: USER_A, tenant_id: TENANT_A, scope: "documents_export", ...opts.claims })
    .setProtectedHeader({ alg: opts.alg ?? "HS256" })
    .setIssuedAt(now - 600)
    .setIssuer(opts.issuer ?? "visao-clara-edge")
    .setAudience(opts.audience ?? "visao-clara-worker")
    .setExpirationTime(now + (opts.expiresIn ?? 300))
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

function call(h: Harness, tok?: string): Promise<Response> {
  const url = new URL("https://worker.example/");
  if (tok !== undefined) url.searchParams.set("token", tok);
  return worker.fetch(new Request(url), h.env as never);
}

async function zipEntries(res: Response): Promise<Map<string, string>> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  assertEquals(String.fromCharCode(...bytes.slice(0, 2)), "PK", "response is a ZIP");
  const reader = new ZipReader(new Uint8ArrayReader(bytes));
  const entries = new Map<string, string>();
  for (const entry of await reader.getEntries()) {
    entries.set(entry.filename, await entry.getData!(new TextWriter()));
  }
  await reader.close();
  return entries;
}

async function errorBody(res: Response): Promise<{ error: string }> {
  return await res.json();
}

function assertNothingRead(h: Harness) {
  assertEquals(h.dbRequests, [], "database must not be queried");
  assertEquals(h.xlsxRequests, [], "spreadsheet function must not be called");
  assertEquals(h.r2Reads, [], "storage must not be read");
}

const A_ROWS = () => [makeRow(TENANT_A, PROJECT_A, "contrato.pdf"), makeRow(TENANT_A, PROJECT_A, "planta.png")];
const B_ROWS = () => [makeRow(TENANT_B, PROJECT_B, "segredo-do-vizinho.pdf")];

// --- Tokens: refused before anything is read ---------------------------------------------------

Deno.test("no token -> 400 MISSING_TOKEN, nothing read", async () => {
  const h = setup({ rows: A_ROWS() });
  try {
    const res = await call(h);
    assertEquals(res.status, 400);
    assertEquals((await errorBody(res)).error, "MISSING_TOKEN");
    assertNothingRead(h);
  } finally {
    h.restore();
  }
});

Deno.test("invalid tokens -> 401 INVALID_TOKEN (never 500), nothing read", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cases: Record<string, () => Promise<string>> = {
    "garbage": () => Promise.resolve("not-a-token"),
    "expired": () => token({ expiresIn: -30 }),
    "signed with another secret": () => token({ secret: "another-secret-0123456789abcdefgh" }),
    "wrong issuer": () => token({ issuer: "attacker" }),
    "wrong audience": () => token({ audience: "other-service" }),
    "HS512": () => token({ alg: "HS512" }),
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
    "claims that are not UUIDs": () => token({ claims: { tenant_id: "tenant-a" } }),
    "missing tenant claim": () => token({ claims: { tenant_id: undefined } }),
  };
  for (const [label, make] of Object.entries(cases)) {
    const h = setup({ rows: [...A_ROWS(), ...B_ROWS()] });
    try {
      const res = await call(h, await make());
      assertEquals(res.status, 401, `${label}: status`);
      assertEquals((await errorBody(res)).error, "INVALID_TOKEN", `${label}: error code`);
      assertNothingRead(h);
    } finally {
      h.restore();
    }
  }
});

Deno.test("a token with a scope the Worker does not serve -> 403 INVALID_SCOPE, nothing read", async () => {
  for (const scope of ["expenses_export", "admin", undefined]) {
    const h = setup({ rows: A_ROWS() });
    try {
      const res = await call(h, await token({ claims: { scope } }));
      assertEquals(res.status, 403);
      assertEquals((await errorBody(res)).error, "INVALID_SCOPE");
      assertNothingRead(h);
    } finally {
      h.restore();
    }
  }
});

// --- Tenant and project isolation -------------------------------------------------------------

Deno.test("cross-tenant: only the token's tenant/project files are exported, queried with the token's ids", async () => {
  const a = A_ROWS();
  const b = B_ROWS();
  const h = setup({ rows: [...a, ...b] });
  try {
    const res = await call(h, await token());
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Content-Type"), "application/zip");
    assert(res.headers.get("Content-Disposition")!.startsWith("attachment"));

    const entries = await zipEntries(res);
    assertEquals([...entries.keys()].sort(), ["documentos/contrato.pdf", "documentos/planta.png"]);
    assertEquals(entries.get("documentos/contrato.pdf"), "content of contrato.pdf");
    assertFalse([...entries.keys()].some((n) => n.includes("segredo")), "the other tenant's file must not be in the ZIP");

    // The database was filtered by the TOKEN's tenant, project and status, not by anything in the URL
    assertEquals(h.dbRequests.length, 1);
    const q = new URLSearchParams(h.dbRequests[0]);
    assertEquals(q.get("tenant_id"), `eq.${TENANT_A}`);
    assertEquals(q.get("project_id"), `eq.${PROJECT_A}`);
    assertEquals(q.get("status"), "eq.uploaded");
    // and no byte of the other tenant's object was touched
    assertFalse(h.r2Reads.some((r) => r.includes(TENANT_B)));
  } finally {
    h.restore();
  }
});

Deno.test("a token for tenant A cannot reach project B's files even if the request names them", async () => {
  const h = setup({ rows: [...A_ROWS(), ...B_ROWS()] });
  try {
    // Inconsistent (tenant A, project B): the filters match nothing, so nothing is served
    const res = await call(h, await token({ claims: { project_id: PROJECT_B } }));
    assertEquals(res.status, 404);
    assertEquals((await errorBody(res)).error, "NO_FILES");
    assertEquals(h.r2Reads, []);
  } finally {
    h.restore();
  }
});

Deno.test("defence in depth: a row of another tenant returned by the database fails the whole export (409)", async () => {
  const h = setup({ rows: [...A_ROWS(), ...B_ROWS()], ignoreFilters: true });
  try {
    const res = await call(h, await token());
    assertEquals(res.status, 409);
    assertEquals((await errorBody(res)).error, "STORAGE_LOCATION_UNTRUSTED");
    assertEquals(h.r2Reads, [], "no storage read before every row is trusted");
  } finally {
    h.restore();
  }
});

Deno.test("a row whose key points at another tenant's object fails closed (409)", async () => {
  const stolen = makeRow(TENANT_B, PROJECT_B, "segredo.pdf").storage_key;
  const bad = makeRow(TENANT_A, PROJECT_A, "contrato.pdf", { storage_key: stolen, r2_key: stolen });
  const h = setup({ rows: [bad], objects: { [stolen]: "TENANT B SECRET" } });
  try {
    const res = await call(h, await token());
    assertEquals(res.status, 409);
    assertEquals((await errorBody(res)).error, "STORAGE_LOCATION_UNTRUSTED");
    assertEquals(h.r2Reads, []);
  } finally {
    h.restore();
  }
});

Deno.test("a row in another bucket or provider fails closed (409)", async () => {
  for (const overrides of [{ storage_bucket: "some-other-bucket", r2_bucket: "some-other-bucket" }, { storage_provider: "local_s3" }]) {
    const h = setup({ rows: [makeRow(TENANT_A, PROJECT_A, "contrato.pdf", overrides)] });
    try {
      const res = await call(h, await token());
      assertEquals(res.status, 409);
      assertEquals((await errorBody(res)).error, "STORAGE_LOCATION_UNTRUSTED");
    } finally {
      h.restore();
    }
  }
});

Deno.test("only uploaded files are requested (pending/failed/deleted are excluded by the query)", async () => {
  const uploaded = makeRow(TENANT_A, PROJECT_A, "ok.pdf");
  const pending = makeRow(TENANT_A, PROJECT_A, "pendente.pdf", { status: "pending" });
  const failed = makeRow(TENANT_A, PROJECT_A, "falhou.pdf", { status: "failed" });
  const h = setup({ rows: [uploaded, pending, failed] });
  try {
    const entries = await zipEntries(await call(h, await token()));
    assertEquals([...entries.keys()], ["documentos/ok.pdf"]);
  } finally {
    h.restore();
  }
});

// --- Export content ---------------------------------------------------------------------------

Deno.test("documents export without files -> 404 NO_FILES", async () => {
  const h = setup({ rows: [] });
  try {
    const res = await call(h, await token());
    assertEquals(res.status, 404);
    assertEquals((await errorBody(res)).error, "NO_FILES");
  } finally {
    h.restore();
  }
});

Deno.test("an object missing from storage -> 409 FILE_MISSING and no ZIP", async () => {
  const rows = A_ROWS();
  const h = setup({ rows, objects: { [rows[0].storage_key]: "only the first exists" } });
  try {
    const res = await call(h, await token());
    assertEquals(res.status, 409);
    assertEquals((await errorBody(res)).error, "FILE_MISSING");
    assertFalse(h.r2Reads.some((r) => r.startsWith("get ")), "nothing is streamed when a file is missing");
  } finally {
    h.restore();
  }
});

Deno.test("duplicate file names are kept apart inside the ZIP", async () => {
  const rows = [makeRow(TENANT_A, PROJECT_A, "fatura.pdf"), makeRow(TENANT_A, PROJECT_A, "fatura.pdf")];
  const h = setup({ rows });
  try {
    const entries = await zipEntries(await call(h, await token()));
    assertEquals([...entries.keys()].sort(), ["documentos/fatura.pdf", "documentos/fatura_1.pdf"]);
  } finally {
    h.restore();
  }
});

Deno.test("full export: ZIP holds the spreadsheet and the documents; the spreadsheet call carries the token's project", async () => {
  const h = setup({ rows: A_ROWS(), xlsx: { status: 200, body: "XLSX-BYTES" } });
  try {
    const tok = await token({ claims: { scope: "full_export" } });
    const res = await call(h, tok);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Content-Disposition"), 'attachment; filename="visao-clara-exportacao-completa.zip"');

    const entries = await zipEntries(res);
    assertEquals([...entries.keys()].sort(), ["documentos/contrato.pdf", "documentos/planta.png", "visao-clara-despesas.xlsx"]);
    assertEquals(entries.get("visao-clara-despesas.xlsx"), "XLSX-BYTES");

    assertEquals(h.xlsxRequests.length, 1);
    const q = new URLSearchParams(h.xlsxRequests[0]);
    assertEquals(q.get("token"), tok);
    assertEquals(q.get("project_id"), PROJECT_A);
  } finally {
    h.restore();
  }
});

Deno.test("full export of a project without documents still returns the spreadsheet", async () => {
  const h = setup({ rows: [], xlsx: { status: 200, body: "XLSX-ONLY" } });
  try {
    const entries = await zipEntries(await call(h, await token({ claims: { scope: "full_export" } })));
    assertEquals([...entries.keys()], ["visao-clara-despesas.xlsx"]);
    assertEquals(entries.get("visao-clara-despesas.xlsx"), "XLSX-ONLY");
  } finally {
    h.restore();
  }
});

Deno.test("full export fails (502) if the spreadsheet function refuses, e.g. the Edge gateway answering 401", async () => {
  for (const status of [401, 403, 500]) {
    const h = setup({ rows: A_ROWS(), xlsx: { status, body: '{"msg":"refused"}' } });
    try {
      const res = await call(h, await token({ claims: { scope: "full_export" } }));
      assertEquals(res.status, 502);
      assertEquals((await errorBody(res)).error, "XLSX_FETCH_FAILED");
      assertEquals(h.r2Reads.filter((r) => r.startsWith("get ")), [], "no partial ZIP is started");
    } finally {
      h.restore();
    }
  }
});

// --- Configuration: the signing secret ---------------------------------------------------------

function captureLogs(): { lines: string[]; restore(): void } {
  const lines: string[] = [];
  const original = { error: console.error, log: console.log, warn: console.warn };
  const capture = (...args: unknown[]) => {
    lines.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack ?? ""}` : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  console.error = capture;
  console.log = capture;
  console.warn = capture;
  return { lines, restore: () => Object.assign(console, original) };
}

Deno.test("missing, empty or blank EXPORT_JWT_SECRET fails closed: 500, nothing read, for any token", async () => {
  for (const [label, secret] of [["missing", undefined], ["empty", ""], ["blank", "  \t "]] as const) {
    const h = setup({ rows: A_ROWS() });
    const logs = captureLogs();
    try {
      if (secret === undefined) delete h.env.EXPORT_JWT_SECRET;
      else h.env.EXPORT_JWT_SECRET = secret;
      // a valid-looking token, a token signed with the literal "undefined", garbage, and no token at all
      for (const tok of [await token(), await token({ secret: "undefined" }), "not-a-token", undefined]) {
        const res = await call(h, tok);
        assertEquals(res.status, 500, `${label}: status`);
        assertEquals((await errorBody(res)).error, "SERVER_MISCONFIGURED", `${label}: error code`);
      }
      assertNothingRead(h);
      assert(logs.lines.some((l) => l.includes("EXPORT_JWT_SECRET is not set")), `${label}: misconfiguration is logged`);
    } finally {
      logs.restore();
      h.restore();
    }
  }
});

Deno.test("the configured EXPORT_JWT_SECRET never appears in logs or responses", async () => {
  const stolen = makeRow(TENANT_B, PROJECT_B, "segredo.pdf").storage_key;
  const scenarios: Array<{ rows: Row[]; ignoreFilters?: boolean; xlsx?: { status: number; body?: string }; tok: () => Promise<string | undefined> }> = [
    { rows: A_ROWS(), tok: () => Promise.resolve("not-a-token") },
    { rows: A_ROWS(), tok: () => token({ expiresIn: -30 }) },
    { rows: A_ROWS(), tok: () => token({ secret: "attacker-secret-0123456789abcdefghij" }) },
    { rows: A_ROWS(), tok: () => token({ claims: { scope: "admin" } }) },
    { rows: [...A_ROWS(), ...B_ROWS()], ignoreFilters: true, tok: () => token() },
    { rows: [makeRow(TENANT_A, PROJECT_A, "x.pdf", { storage_key: stolen, r2_key: stolen })], tok: () => token() },
    { rows: A_ROWS(), xlsx: { status: 401, body: "{}" }, tok: () => token({ claims: { scope: "full_export" } }) },
    { rows: A_ROWS(), tok: () => token() },
  ];
  for (const s of scenarios) {
    const h = setup({ rows: s.rows, ignoreFilters: s.ignoreFilters, xlsx: s.xlsx });
    const logs = captureLogs();
    try {
      const res = await call(h, await s.tok());
      const body = new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()));
      assertFalse(body.includes(SECRET), "secret in response body");
      assertFalse([...res.headers.values()].some((v) => v.includes(SECRET)), "secret in response headers");
    } finally {
      logs.restore();
      h.restore();
    }
    assertFalse(logs.lines.some((l) => l.includes(SECRET)), "secret in logs");
  }
});
