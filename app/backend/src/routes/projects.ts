import { isProjectPhase, isProjectStatus } from "@municipal-tracker/shared";
import { apiError, json, methodNotAllowed } from "../services/http";
import { getProject, InvalidCursorError, listProjects, type ListProjectsOptions } from "../services/projects-store";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseListOptions(params: URLSearchParams): ListProjectsOptions | Response {
  const phase = params.get("phase");
  const status = params.get("status");
  const limit = params.get("limit");
  const cursor = params.get("cursor");
  if (phase !== null && !isProjectPhase(phase)) return apiError(400, "invalid_phase", "Unknown project phase.");
  if (status !== null && !isProjectStatus(status)) return apiError(400, "invalid_status", "Unknown project status.");
  if (limit !== null && !(/^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= MAX_LIMIT)) {
    return apiError(400, "invalid_limit", `Limit must be between 1 and ${MAX_LIMIT}.`);
  }
  return {
    ...(phase !== null && { phase }),
    ...(status !== null && { status }),
    ...(cursor !== null && { cursor }),
    limit: limit === null ? DEFAULT_LIMIT : Number(limit),
  } as ListProjectsOptions;
}

async function listResponse(env: Env, url: URL): Promise<Response> {
  const options = parseListOptions(url.searchParams);
  if (options instanceof Response) return options;
  try {
    return json(await listProjects(env.MCT_DB, options));
  } catch (error) {
    if (error instanceof InvalidCursorError) return apiError(400, "invalid_cursor", "Cursor is not valid.");
    throw error;
  }
}

export async function projectsRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed();
  const url = new URL(request.url);
  if (url.pathname === "/api/projects") return listResponse(env, url);
  const id = /^\/api\/projects\/([^/]+)$/.exec(url.pathname)?.[1];
  if (!id || !PROJECT_ID.test(id)) return apiError(404, "not_found", "Route not found.");
  const project = await getProject(env.MCT_DB, id.toLowerCase());
  return project ? json(project) : apiError(404, "project_not_found", "Project not found.");
}
