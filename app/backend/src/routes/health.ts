import type { HealthResponse } from "@municipal-tracker/shared";
import { SERVICE_NAME } from "@municipal-tracker/shared";
import { json } from "../services/http";

export function healthRoute(): Response {
  const body: HealthResponse = { status: "ok", service: SERVICE_NAME, timestamp: new Date().toISOString() };
  return json(body);
}
