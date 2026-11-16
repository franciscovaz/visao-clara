// Test double for std `serve`: captures the handler instead of opening a listener, so the REAL
// function module can be imported and its handler called directly. Used only through
// _tests/import_map.json (never from deno.json: Supabase honours deno.json when it deploys).
export function serve(handler: (req: Request) => Response | Promise<Response>) {
  (globalThis as unknown as { __handler?: unknown }).__handler = handler;
}
