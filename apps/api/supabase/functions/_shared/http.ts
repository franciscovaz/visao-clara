/** CORS headers for browser-called functions (auth uses bearer tokens, never cookies). */
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-jwt, apikey",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

export function jsonError(error: string, status = 400, extra?: Record<string, unknown>): Response {
  const body = { ok: false, error, ...extra };
  return jsonResponse(body, status);
}

/**
 * Wraps a function handler so that EVERY response it produces carries the CORS headers. Without
 * them the browser hides the response from fetch(), even a successful 200 (the request reaches
 * the server and takes effect, but the page sees a network error). Responses that already set
 * Access-Control-Allow-Origin are returned untouched; status, body and other headers are kept.
 * A thrown Response (e.g. requireUser's 401) is returned with CORS; any other throw becomes a
 * generic 500, so nothing escapes without headers.
 */
export function withCors(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    let res: Response;
    try {
      res = await handler(req);
    } catch (err) {
      if (err instanceof Response) {
        res = err;
      } else {
        console.error("Unhandled function error:", err);
        return jsonError("Erro interno do servidor", 500);
      }
    }
    if (res.headers.has("Access-Control-Allow-Origin")) return res;

    const headers = new Headers(res.headers);
    for (const [name, value] of Object.entries(CORS_HEADERS)) {
      if (!headers.has(name)) headers.set(name, value);
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
