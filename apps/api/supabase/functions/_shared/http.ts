export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-jwt, apikey",
    },
  });
}

export function jsonError(error: string, status = 400, extra?: Record<string, unknown>): Response {
  const body = { ok: false, error, ...extra };
  return jsonResponse(body, status);
}
