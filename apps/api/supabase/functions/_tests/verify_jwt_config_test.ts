// Run from apps/api/supabase/functions:
//   deno test --no-lock --allow-env --allow-read=.. --import-map=_tests/import_map.json _tests/
//
// Guards the gateway JWT settings in supabase/config.toml. Turning verify_jwt off removes the
// gateway's check, so it is only acceptable where the function authenticates every request itself.
// This test fails if:
//   - a function other than the approved ones gets (or loses) a verify_jwt entry;
//   - an approved function stops authenticating in code;
//   - get-project-expenses-xlsx reads the database before it has verified the export token.
import { assert, assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { parse } from "https://deno.land/std@0.192.0/toml/mod.ts";

/**
 * Functions configured with verify_jwt = false, each approved explicitly.
 * get-project-expenses-xlsx: approved 2026-11-16 (called by the export Worker, which has no
 * Supabase credential; it verifies the signed export token itself). Do not extend this list
 * without the same review.
 */
const APPROVED_VERIFY_JWT_FALSE = [
  "ai-chat-assistant",
  "cleanup-pending-uploads",
  "generate-checklist-suggestions",
  "get-project-expenses-xlsx",
  "r2-confirm-upload",
  "r2-sign-download",
  "r2-sign-upload",
];

const read = (rel: string) => Deno.readTextFile(new URL(rel, import.meta.url));

async function config(): Promise<Record<string, { verify_jwt?: boolean }>> {
  const parsed = parse(await read("../../config.toml")) as { functions?: Record<string, { verify_jwt?: boolean }> };
  return parsed.functions ?? {};
}

Deno.test("verify_jwt is false for exactly the approved functions, and no other function has an entry", async () => {
  const functions = await config();
  assertEquals(Object.keys(functions).sort(), [...APPROVED_VERIFY_JWT_FALSE].sort());
  for (const name of APPROVED_VERIFY_JWT_FALSE) assertEquals(functions[name].verify_jwt, false, name);
});

Deno.test("get-project-expenses-xlsx has verify_jwt = false (the Worker calls it without a Supabase credential)", async () => {
  assertEquals((await config())["get-project-expenses-xlsx"]?.verify_jwt, false);
});

Deno.test("every function without gateway verification authenticates in code", async () => {
  for (const name of APPROVED_VERIFY_JWT_FALSE) {
    const source = await read(`../${name}/index.ts`);
    if (name === "get-project-expenses-xlsx") {
      assert(source.includes("jwtVerify("), `${name}: must verify the export token`);
      assert(source.includes("EXPORT_VERIFY_OPTIONS"), `${name}: must use the shared verification options`);
      assert(source.includes("parseExportClaims("), `${name}: must check the claims`);
      assert(source.includes("XLSX_SCOPES"), `${name}: must restrict the accepted scopes`);
    } else {
      assert(/requireUser\(/.test(source), `${name}: must call requireUser()`);
    }
  }
});

Deno.test("get-project-expenses-xlsx verifies the token before reading any data", async () => {
  const source = await read("../get-project-expenses-xlsx/index.ts");
  const at = (needle: string) => {
    const i = source.indexOf(needle);
    assert(i >= 0, `missing: ${needle}`);
    return i;
  };
  const verified = at("await jwtVerify(");
  assert(at('getEnv("EXPORT_JWT_SECRET")') < verified, "the secret is read (and its absence fails) before verification");
  assert(verified < at("parseExportClaims("), "claims are checked after the signature");
  assert(at("parseExportClaims(") < at("createClient("), "no database client before the claims are accepted");
  assert(at("parseExportClaims(") < at('.from("expenses")'), "no query before the claims are accepted");
  assert(!/\.from\("expenses"\)[\s\S]*jwtVerify\(/.test(source), "no query precedes verification");
});
