import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  return new Response(
    JSON.stringify({ ok: true, message: "TODO" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});
