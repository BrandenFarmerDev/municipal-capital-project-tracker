import { apiError } from "./http";

const DEADLINE_MS = 1000;
const RETRY_SECONDS = "60";

function canonicalAddress(value: string | null): string {
  if (!value || value.length > 45) return "invalid-client-address";
  if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)) {
    return value.split(".").every((octet) => Number(octet) <= 255) ? value : "invalid-client-address";
  }
  if (value.includes(":") && /^[\da-fA-F:.]+$/.test(value)) {
    try { return new URL(`http://[${value}]/`).hostname; }
    catch { /* Invalid literals share the same bounded bucket. */ }
  }
  return "invalid-client-address";
}

async function admission(request: Request, env: Env): Promise<unknown> {
  const address = canonicalAddress(request.headers.get("CF-Connecting-IP"));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  const key = `api:v1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return env.API_RATE_LIMITER.limit({ key });
}

/** Every HTTP fetch awaits this decision before dispatch; late decisions cannot dispatch. */
export async function protectRequest(request: Request, env: Env): Promise<Response | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reason = "binding_missing";
  let status = 503;
  try {
    if (env.API_RATE_LIMITER) {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("deadline")), DEADLINE_MS);
      });
      reason = "binding_failure";
      const result = await Promise.race([admission(request, env), deadline]);
      if (typeof result === "object" && result !== null && "success" in result) {
        if (result.success === true) return null;
        if (result.success === false) { status = 429; reason = "limit_exceeded"; }
        else reason = "malformed_result";
      } else reason = "malformed_result";
    }
  } catch {
    // Dependency errors and deadlines are deliberately indistinguishable to clients.
  } finally {
    clearTimeout(timer);
  }
  console.warn(JSON.stringify({ event: "api_request_guard", status, outcome: status === 429 ? "denied" : "unavailable", reason }));
  const response = apiError(status, status === 429 ? "rate_limited" : "rate_limit_unavailable", "Wait at least 60 seconds before trying again manually.");
  response.headers.set("Retry-After", RETRY_SECONDS);
  return response;
}
