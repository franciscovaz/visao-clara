// Run from apps/api/supabase/functions:
//   deno test --no-lock --allow-env --allow-read=.. --import-map=_tests/import_map.json _tests/
//
// Static guard: a function either wraps its handler with withCors() (every response gets CORS),
// or every `new Response(...)` it builds sets CORS headers itself. A response without them is
// invisible to the browser even when the request succeeded on the server.
import { assert } from "https://deno.land/std@0.192.0/testing/asserts.ts";

const FUNCTIONS_DIR = new URL("../", import.meta.url);

/** Text of each `new Response(...)` call, with its line number. */
function responseCalls(src: string): Array<{ line: number; call: string }> {
  const out: Array<{ line: number; call: string }> = [];
  for (const m of src.matchAll(/new Response\(/g)) {
    let depth = 0;
    let i = m.index! + "new Response".length;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) break;
    }
    out.push({ line: src.slice(0, m.index).split("\n").length, call: src.slice(m.index, i + 1) });
  }
  return out;
}

Deno.test("every Edge Function response carries CORS headers", async () => {
  const problems: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (!entry.isDirectory || entry.name.startsWith("_")) continue;
    let src: string;
    try {
      src = await Deno.readTextFile(new URL(`${entry.name}/index.ts`, FUNCTIONS_DIR));
    } catch {
      continue;
    }
    if (/serve\(withCors\(/.test(src)) continue; // every response gets CORS from the wrapper
    for (const { line, call } of responseCalls(src)) {
      const setsCors = /corsHeaders\(\)|Access-Control-Allow-Origin|CORS_HEADERS/.test(call);
      // Re-wrapping a thrown Response with headers that were just given CORS (AI functions)
      const rewrapsWithCors = /new Response\((err|error)\.body,/.test(call) &&
        /for \(const \[name, value\] of Object\.entries\(corsHeaders\(\)\)\) headers\.set/.test(src);
      if (!setsCors && !rewrapsWithCors) problems.push(`${entry.name}/index.ts:${line}`);
    }
  }
  assert(problems.length === 0, `responses without CORS headers (use withCors or corsHeaders()): ${problems.join(", ")}`);
});
