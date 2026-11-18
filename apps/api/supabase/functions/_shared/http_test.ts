// Run from apps/api/supabase/functions: deno test --allow-env _shared/
import { assert, assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { CORS_HEADERS, jsonError, jsonResponse, withCors } from "./http.ts";

function assertCors(res: Response) {
  for (const [name, value] of Object.entries(CORS_HEADERS)) assertEquals(res.headers.get(name), value, name);
}

const req = () => new Request("http://localhost/fn", { method: "POST" });

Deno.test("withCors adds CORS to a success response and keeps status, body and headers", async () => {
  const handler = withCors(() =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Disposition": "attachment" },
    })
  );
  const res = await handler(req());
  assertEquals(res.status, 200);
  assertCors(res);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Content-Disposition"), "attachment");
  assertEquals(await res.json(), { ok: true });
});

Deno.test("withCors adds CORS to raw error responses (400, 404, 409, 500)", async () => {
  for (const status of [400, 404, 409, 500]) {
    const res = await withCors(() => new Response("{}", { status, headers: { "Content-Type": "application/json" } }))(req());
    assertEquals(res.status, status);
    assertCors(res);
    await res.body?.cancel();
  }
});

Deno.test("withCors leaves responses that already set CORS untouched", async () => {
  const original = new Response(null, { status: 200, headers: { "Access-Control-Allow-Origin": "https://example.test", "Access-Control-Allow-Methods": "POST" } });
  const res = await withCors(() => original)(req());
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "https://example.test");
  assertEquals(res.headers.get("Access-Control-Allow-Methods"), "POST");
});

Deno.test("withCors handles a thrown Response (e.g. requireUser's 401) and any other throw", async () => {
  const thrown = await withCors(() => {
    throw new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { "Content-Type": "application/json" } });
  })(req());
  assertEquals(thrown.status, 401);
  assertCors(thrown);
  assertEquals((await thrown.json()).error, "UNAUTHORIZED");

  const realError = console.error;
  console.error = () => {};
  try {
    const crashed = await withCors(() => {
      throw new Error("boom");
    })(req());
    assertEquals(crashed.status, 500);
    assertCors(crashed);
    const body = await crashed.json();
    assertEquals(body.ok, false);
    assert(!JSON.stringify(body).includes("boom"), "internal error details are not exposed");
  } finally {
    console.error = realError;
  }
});

Deno.test("withCors works for an async handler and a body-less preflight", async () => {
  const res = await withCors(async () => await Promise.resolve(new Response(null, { status: 204 })))(req());
  assertEquals(res.status, 204);
  assertCors(res);
});

Deno.test("jsonResponse and jsonError still carry the same CORS headers", async () => {
  const ok = jsonResponse({ a: 1 }, 201);
  const err = jsonError("x", 409, { code: "C" });
  assertCors(ok);
  assertCors(err);
  assertEquals(ok.status, 201);
  assertEquals(await err.json(), { ok: false, error: "x", code: "C" });
  await ok.body?.cancel();
});
