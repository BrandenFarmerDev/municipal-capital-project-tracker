export * from "./money";
export * from "./projects";

export const SERVICE_NAME = "municipal-capital-project-tracker-api";

// The scaffold enforces a single owner; roles are reserved vocabulary for future multi-agency work.
export const ROLES = ["admin", "project_manager", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export interface HealthResponse {
  status: "ok";
  service: typeof SERVICE_NAME;
  timestamp: string;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) return false;
  return "status" in value && value.status === "ok"
    && "service" in value && value.service === SERVICE_NAME
    && "timestamp" in value && typeof value.timestamp === "string"
    && Number.isFinite(Date.parse(value.timestamp));
}
