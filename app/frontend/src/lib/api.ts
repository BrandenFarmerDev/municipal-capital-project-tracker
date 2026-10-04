import { isHealthResponse, type HealthResponse, type Paginated, type ProjectDetail, type ProjectPhase, type ProjectStatus, type ProjectSummary } from "@municipal-tracker/shared";
import { isProjectDetail, isProjectPage } from "./project-response";

export class ApiRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const messages: Record<number, string> = {
  401: "Sign in through Cloudflare Access as the owner to continue.",
  404: "That item was not found.",
  503: "The service is temporarily unavailable. Try again shortly or contact the application owner.",
};

const withTimeout = (signal: AbortSignal | undefined, ms: number) =>
  signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, { credentials: "include", signal: withTimeout(signal, 10000) });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const unconfigured = typeof body === "object" && body !== null && "error" in body && body.error === "auth_unconfigured";
    throw new ApiRequestError(response.status, unconfigured ? "Owner access is not configured for this environment. Contact the application owner." : messages[response.status] ?? "The request could not be completed. Try again shortly.");
  }
  try { return await response.json(); }
  catch { throw new Error("The API returned an unreadable response. Try again or sign in through Cloudflare Access."); }
}

export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const body = await getJson("/api/health", signal);
  if (!isHealthResponse(body)) throw new Error("The API returned an invalid health response.");
  return body;
}

export interface ProjectQuery { phase?: ProjectPhase | ""; status?: ProjectStatus | ""; cursor?: string }

export async function listProjects(query: ProjectQuery, signal?: AbortSignal): Promise<Paginated<ProjectSummary>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const search = params.size > 0 ? `?${params}` : "";
  const body = await getJson(`/api/projects${search}`, signal);
  if (!isProjectPage(body)) throw new Error("The API returned an invalid project list. Try again or contact the application owner.");
  return body;
}

export async function getProject(id: string, signal?: AbortSignal): Promise<ProjectDetail> {
  const body = await getJson(`/api/projects/${encodeURIComponent(id)}`, signal);
  if (!isProjectDetail(body)) throw new Error("The API returned an invalid project. Try again or contact the application owner.");
  return body;
}

export function errorMessage(reason: unknown): string {
  if (reason instanceof TypeError) return "The API could not be reached. Check your connection and try again.";
  if (typeof reason === "object" && reason !== null && "name" in reason && reason.name === "TimeoutError") return "The request timed out. Try again shortly.";
  return reason instanceof Error ? reason.message : "The API is unavailable. Try again shortly.";
}
