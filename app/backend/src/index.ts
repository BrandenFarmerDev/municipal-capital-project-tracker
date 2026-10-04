import { healthRoute } from "./routes/health";
import { projectsRoute } from "./routes/projects";
import { apiError, hardenResponse, methodNotAllowed } from "./services/http";
import { authorize, Problem } from "./services/security";

const isProtectedPath = (path: string) => path === "/api/projects" || path.startsWith("/api/projects/");

async function route(request: Request, env: Env, path: string): Promise<Response> {
  if (path === "/api/health") return request.method === "GET" || request.method === "HEAD" ? healthRoute() : methodNotAllowed();
  await authorize(request, env);
  return projectsRoute(request, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowedOrigin = origin === env.ALLOWED_ORIGIN ? origin : null;
    const finish = (response: Response) => hardenResponse(response, allowedOrigin);
    if (origin !== null && !allowedOrigin) {
      return finish(apiError(403, "origin_not_allowed", "This origin is not allowed."));
    }
    const path = new URL(request.url).pathname;
    if (path !== "/api/health" && !isProtectedPath(path)) return finish(apiError(404, "not_found", "Route not found."));
    if (request.method === "OPTIONS") {
      return finish(new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } }));
    }
    try {
      const response = await route(request, env, path);
      return finish(request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response);
    } catch (error) {
      const known = error instanceof Problem;
      return finish(apiError(known ? error.status : 500, known ? error.code : "request_failed", "The request could not be completed."));
    }
  },
} satisfies ExportedHandler<Env>;
