import type { ApiError } from "@municipal-tracker/shared";

export function json(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, init);
}

export function apiError(status: number, error: string, message: string): Response {
  return json({ error, message } satisfies ApiError, { status });
}

export function methodNotAllowed(): Response {
  const response = apiError(405, "method_not_allowed", "Method not allowed.");
  response.headers.set("Allow", "GET, HEAD, OPTIONS");
  return response;
}

export function hardenResponse(response: Response, allowedOrigin: string | null): Response {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  response.headers.set("Vary", "Origin");
  response.headers.set("X-Request-Id", crypto.randomUUID());
  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return response;
}
