// Run from apps/api/supabase/functions:
//   deno test --no-lock --allow-env --allow-read=.. --import-map=_tests/import_map.json _tests/
//
// The browser can only read a cross-origin response that carries Access-Control-Allow-Origin.
// Without it a request can SUCCEED on the server (e.g. an upload is confirmed) while the page sees
// a network error. These tests call the REAL handlers of the document functions (the import map
// only swaps the HTTP server for a test double) with Supabase Auth, PostgREST and R2 stubbed through
// fetch, and check CORS on preflight, authentication errors, validation errors, storage errors and
// SUCCESS responses.
import { assert, assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";

type Handler = (req: Request) => Promise<Response>;
const g = globalThis as unknown as { __handler: Handler };

async function load(name: string): Promise<Handler> {
  await import(`../${name}/index.ts`);
  return g.__handler;
}

const SUPABASE_URL = "http://supabase.test";
const R2_HOST = "0123456789abcdef0123456789abcdef.eu.r2.cloudflarestorage.com";
const BUCKET = "test-docs-bucket";
const USER_TOKEN = "valid-user-token";
const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FILE = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const PDF = new TextEncoder().encode("%PDF-1.4\n" + "x".repeat(1015)); // 1024 bytes

for (const [k, v] of Object.entries({
  VC_SUPABASE_URL: SUPABASE_URL,
  VC_SUPABASE_ANON_KEY: "anon-key-for-tests",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-tests",
  FILE_STORAGE_PROVIDER: "r2",
  VC_R2_ENDPOINT: `https://${R2_HOST}`,
  VC_R2_ACCESS_KEY_ID: "test-access-key-id",
  VC_R2_SECRET_ACCESS_KEY: "test-secret-access-key",
  VC_R2_BUCKET: BUCKET,
})) Deno.env.set(k, v);

const confirmUpload = await load("r2-confirm-upload");
const signDownload = await load("r2-sign-download");
const signUpload = await load("r2-sign-upload");
const deleteDocument = await load("delete-document");
const ALL: Record<string, Handler> = {
  "r2-confirm-upload": confirmUpload,
  "r2-sign-download": signDownload,
  "r2-sign-upload": signUpload,
  "delete-document": deleteDocument,
};

function fileRow(overrides: Record<string, unknown> = {}) {
  const key = `${TENANT}/${PROJECT}/${DOC}/${FILE}/contrato.pdf`;
  return {
    id: FILE, tenant_id: TENANT, project_id: PROJECT, document_id: DOC, file_name: "contrato.pdf",
    status: "pending", size_bytes: PDF.length, mime_type: "application/pdf",
    storage_provider: "r2", storage_bucket: BUCKET, storage_key: key, r2_bucket: BUCKET, r2_key: key,
    ...overrides,
  };
}

interface Backend {
  file?: Record<string, unknown> | null;
  object?: "present" | "missing";
  updateFails?: boolean;
}

/** Stubs Supabase Auth, PostgREST (document_files, documents) and the R2 object. */
function stub(backend: Backend): () => void {
  const real = globalThis.fetch;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const single = (headers.get("Accept") ?? "").includes("vnd.pgrst.object");

    if (url.origin === SUPABASE_URL && url.pathname === "/auth/v1/user") {
      return Promise.resolve(headers.get("Authorization") === `Bearer ${USER_TOKEN}`
        ? json({ id: USER_ID, aud: "authenticated", email: "user@example.test" })
        : json({ code: 401, msg: "invalid JWT" }, 401));
    }
    if (url.origin === SUPABASE_URL && url.pathname === "/rest/v1/document_files") {
      if (method === "PATCH") {
        return Promise.resolve(backend.updateFails ? json({ message: "db error" }, 500) : json([{ id: FILE }]));
      }
      const row = backend.file;
      if (single) return Promise.resolve(row ? json(row) : json({ code: "PGRST116", message: "no rows" }, 406));
      return Promise.resolve(json(row ? [row] : []));
    }
    if (url.origin === SUPABASE_URL && url.pathname === "/rest/v1/documents") {
      const doc = { id: DOC, tenant_id: TENANT, project_id: PROJECT };
      return Promise.resolve(single ? json(doc) : json([doc]));
    }
    if (url.host === R2_HOST) {
      if (backend.object !== "present") return Promise.resolve(new Response(null, { status: 404 }));
      if (method === "HEAD") {
        return Promise.resolve(new Response(null, { status: 200, headers: { "Content-Length": String(PDF.length), "Content-Type": "application/pdf", ETag: '"etag-1"' } }));
      }
      if (method === "GET") return Promise.resolve(new Response(PDF.slice(0, 64), { status: 206, headers: { "Content-Type": "application/pdf" } }));
    }
    throw new Error(`unexpected request ${method} ${url.origin}${url.pathname}`);
  };
  return () => {
    globalThis.fetch = real;
  };
}

function post(handler: Handler, body: unknown, auth = true): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Origin: "http://localhost:3001" };
  if (auth) {
    headers["x-user-jwt"] = USER_TOKEN;
    headers["Authorization"] = "Bearer anon-key-for-tests";
  }
  return handler(new Request("http://localhost/fn", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

async function assertCors(res: Response, status: number, label: string): Promise<Record<string, unknown>> {
  assertEquals(res.status, status, `${label}: status`);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*", `${label}: Access-Control-Allow-Origin`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

const quiet = async (fn: () => Promise<void>) => {
  const realError = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = realError;
  }
};

// --- All document functions: preflight, authentication and validation errors -----------------------

Deno.test("preflight, missing token and invalid token all carry CORS (all document functions)", async () => {
  for (const [name, handler] of Object.entries(ALL)) {
    const restore = stub({ file: fileRow() });
    try {
      const preflight = await handler(new Request("http://localhost/fn", { method: "OPTIONS", headers: { Origin: "http://localhost:3001" } }));
      await assertCors(preflight, 200, `${name} OPTIONS`);
      await quiet(async () => {
        await assertCors(await post(handler, {}, false), 401, `${name} no token`);
        const res = await handler(new Request("http://localhost/fn", {
          method: "POST",
          headers: { "x-user-jwt": "bad-token", "Content-Type": "application/json" },
          body: "{}",
        }));
        await assertCors(res, 401, `${name} invalid token`);
      });
    } finally {
      restore();
    }
  }
});

Deno.test("an unreadable request body is a 400 with CORS (all document functions)", async () => {
  for (const [name, handler] of Object.entries(ALL)) {
    const restore = stub({ file: fileRow() });
    try {
      await quiet(async () => {
        await assertCors(await post(handler, "{not json"), 400, `${name} invalid JSON`);
      });
    } finally {
      restore();
    }
  }
});

// --- r2-confirm-upload: the response the browser could not read --------------------------------------

Deno.test("r2-confirm-upload: a successful confirmation (200) carries CORS", async () => {
  const restore = stub({ file: fileRow({ status: "pending" }), object: "present" });
  try {
    const body = await assertCors(await post(confirmUpload, { document_file_id: FILE }), 200, "confirm success");
    assertEquals(body.ok, true);
  } finally {
    restore();
  }
});

Deno.test("r2-confirm-upload: the idempotent 'already uploaded' 200 carries CORS", async () => {
  const restore = stub({ file: fileRow({ status: "uploaded" }), object: "present" });
  try {
    const body = await assertCors(await post(confirmUpload, { document_file_id: FILE }), 200, "confirm idempotent");
    assertEquals(body.ok, true);
  } finally {
    restore();
  }
});

Deno.test("r2-confirm-upload: error paths carry CORS (not found, not stored yet, database error)", async () => {
  await quiet(async () => {
    let restore = stub({ file: null });
    try {
      await assertCors(await post(confirmUpload, { document_file_id: FILE }), 404, "confirm row not found");
    } finally {
      restore();
    }
    restore = stub({ file: fileRow(), object: "missing" });
    try {
      const body = await assertCors(await post(confirmUpload, { document_file_id: FILE }), 409, "confirm object missing");
      assertEquals(body.code, "UPLOAD_NOT_FOUND");
    } finally {
      restore();
    }
    restore = stub({ file: fileRow(), object: "present", updateFails: true });
    try {
      await assertCors(await post(confirmUpload, { document_file_id: FILE }), 500, "confirm update error");
    } finally {
      restore();
    }
    restore = stub({ file: fileRow() });
    try {
      await assertCors(await post(confirmUpload, { document_file_id: "not-a-uuid" }), 400, "confirm bad id");
    } finally {
      restore();
    }
  });
});

// --- r2-sign-download --------------------------------------------------------------------------------

Deno.test("r2-sign-download: a successful signed URL (200) carries CORS and points at the EU endpoint", async () => {
  const restore = stub({ file: fileRow({ status: "uploaded" }) });
  try {
    const body = await assertCors(await post(signDownload, { document_file_id: FILE }), 200, "download success") as {
      ok: boolean;
      download: { url: string };
    };
    assertEquals(body.ok, true);
    const url = new URL(body.download.url);
    assertEquals(url.host, R2_HOST);
    assert(url.searchParams.get("response-content-disposition")?.startsWith("attachment"), "download stays an attachment");
  } finally {
    restore();
  }
});

Deno.test("r2-sign-download: error paths carry CORS (bad id, not found, not uploaded yet)", async () => {
  await quiet(async () => {
    let restore = stub({ file: fileRow() });
    try {
      await assertCors(await post(signDownload, { document_file_id: "not-a-uuid" }), 400, "download bad id");
    } finally {
      restore();
    }
    restore = stub({ file: null });
    try {
      await assertCors(await post(signDownload, { document_file_id: FILE }), 404, "download not found");
    } finally {
      restore();
    }
    restore = stub({ file: fileRow({ status: "pending" }) });
    try {
      await assertCors(await post(signDownload, { document_file_id: FILE }), 409, "download not uploaded");
    } finally {
      restore();
    }
  });
});
