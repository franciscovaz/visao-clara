// Run from apps/api/supabase/functions: deno test --allow-env _shared/
//
// Authentication failures must reach the browser: a 401 without CORS headers is invisible to
// fetch() (it surfaces as a network error), so an expired session could not be told apart from
// an outage. requireUser() throws these Responses and most functions return them as they are.
import { assert, assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { getUserOrThrow, requireUser } from "./auth.ts";

function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  Deno.env.set("VC_SUPABASE_URL", "http://supabase.test");
  Deno.env.set("VC_SUPABASE_ANON_KEY", "anon-key-for-tests");
  return fn();
}

async function thrown(fn: () => Promise<unknown>): Promise<Response> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
  throw new Error("expected a Response to be thrown");
}

function assertCorsError(res: Response) {
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assert(res.headers.get("Access-Control-Allow-Headers")?.toLowerCase().includes("x-user-jwt"));
  assertEquals(res.headers.get("Content-Type"), "application/json");
}

Deno.test("requireUser: missing token -> 401 with CORS headers and the same body", async () => {
  const res = await thrown(() => requireUser(new Request("http://localhost/fn", { method: "POST" })));
  assertCorsError(res);
  const body = await res.json();
  assertEquals(body.error, "UNAUTHORIZED");
  assertEquals(body.reason, "Missing authentication token");
});

Deno.test("requireUser: a Basic / non-Bearer Authorization header is refused with CORS headers", async () => {
  const req = new Request("http://localhost/fn", { method: "POST", headers: { Authorization: "Basic abc" } });
  assertCorsError(await thrown(() => requireUser(req)));
});

Deno.test("requireUser: token rejected by Supabase Auth -> 401 with CORS headers", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(new Response(JSON.stringify({ code: 401, msg: "invalid JWT" }), { status: 401, headers: { "Content-Type": "application/json" } }));
  try {
    const req = new Request("http://localhost/fn", { method: "POST", headers: { "x-user-jwt": "expired.or.invalid" } });
    const res = await withEnv(() => thrown(() => requireUser(req)));
    assertCorsError(res);
    const body = await res.json();
    assertEquals(body.error, "UNAUTHORIZED");
    assertEquals(body.reason, "Invalid or expired token");
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("requireUser: a valid token still authenticates (x-user-jwt wins over Authorization)", async () => {
  const realFetch = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (_input, init) => {
    seen.push(new Headers(init?.headers).get("Authorization") ?? "");
    return Promise.resolve(new Response(
      JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "a@example.com" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
  };
  try {
    const req = new Request("http://localhost/fn", {
      method: "POST",
      headers: { "x-user-jwt": "user-token", Authorization: "Bearer anon-key" },
    });
    const auth = await withEnv(() => requireUser(req));
    assertEquals(auth.userId, "11111111-1111-4111-8111-111111111111");
    assertEquals(auth.token, "user-token");
    assertEquals(seen, ["Bearer user-token"]); // the user's token, not the anon key, was validated
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("getUserOrThrow: missing apikey / token -> 401 with CORS headers", async () => {
  const noApiKey = await getUserOrThrow(new Request("http://localhost/fn"));
  assert(noApiKey instanceof Response);
  assertCorsError(noApiKey);

  const noToken = await getUserOrThrow(new Request("http://localhost/fn", { headers: { apikey: "anon" } }));
  assert(noToken instanceof Response);
  assertCorsError(noToken);
});
