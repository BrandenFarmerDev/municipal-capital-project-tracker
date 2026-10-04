import { describe, expect, it } from "vitest";
import { apiError, hardenResponse, json, methodNotAllowed } from "./http";

describe("http helpers", () => {
  it("builds JSON and error responses", async () => {
    expect(await json({ a: 1 }).json()).toEqual({ a: 1 });
    const error = apiError(418, "teapot", "Short and stout.");
    expect(error.status).toBe(418);
    expect(await error.json()).toEqual({ error: "teapot", message: "Short and stout." });
  });
  it("describes allowed methods on 405", () => {
    const response = methodNotAllowed();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
  });
  it("hardens every response and only adds CORS for an allowed origin", () => {
    const plain = hardenResponse(json({}), null);
    expect(plain.headers.get("Cache-Control")).toBe("no-store");
    expect(plain.headers.get("X-Frame-Options")).toBe("DENY");
    expect(plain.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(plain.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(plain.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const cors = hardenResponse(json({}), "https://app.example.com");
    expect(cors.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
    expect(cors.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });
});
