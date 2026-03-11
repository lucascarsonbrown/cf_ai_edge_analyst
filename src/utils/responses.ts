import { CORS_HEADERS } from "../config";

/** Returns a JSON response with CORS headers. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

/** Returns a structured error JSON response. */
export function errorResponse(message: string, code: string, status = 400): Response {
  return json({ error: message, code }, status);
}

/** Returns a preflight CORS response for OPTIONS requests. */
export function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
