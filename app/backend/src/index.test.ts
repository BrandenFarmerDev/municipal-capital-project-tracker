import { afterEach, describe, expect, it, vi } from "vitest";
import type { Paginated, ProjectSummary } from "@municipal-tracker/shared";
import worker from "./index";
import { authedRequest, fixture, stubJwks } from "./test/fixtures";

afterEach(() => vi.unstubAllGlobals());
const url = (path: string) => `https://api.example.com${path}`;

describe("public health route", () => {
  it("answers without authentication", async () => {
    const { env, close } = fixture();
    const response = await worker.fetch(new Request(url("/api/health")), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    close();
  });
  it("serves HEAD without a body and rejects other methods", async () => {
    const { env, close } = fixture();
    const head = await worker.fetch(new Request(url("/api/health"), { method: "HEAD" }), env);
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    const post = await worker.fetch(new Request(url("/api/health"), { method: "POST" }), env);
    expect(post.status).toBe(405);
    expect(post.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
    close();
  });
});

describe("protected project routes", () => {
  it("returns 401 without an Access token", async () => {
    const { env, close } = fixture();
    stubJwks();
    const response = await worker.fetch(new Request(url("/api/projects")), env);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "authentication_required" });
    close();
  });
  it("returns 401 for a token from a different user", async () => {
    const { env, close } = fixture();
    stubJwks();
    const { ownerToken } = await import("./test/fixtures");
    const token = await ownerToken(env, { email: "someone@example.com" });
    const response = await worker.fetch(new Request(url("/api/projects/a1000000-0000-4000-8000-000000000001"), { headers: { "Cf-Access-Jwt-Assertion": token } }), env);
    expect(response.status).toBe(401);
    close();
  });
  it("returns 503 while Access is unconfigured, as in local development", async () => {
    const { env, close } = fixture();
    const response = await worker.fetch(new Request(url("/api/projects")), { ...env, ACCESS_AUD: "unconfigured" });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "auth_unconfigured" });
    close();
  });
  it("lists projects for the owner, including CORS for the allowed origin", async () => {
    const { env, close } = fixture();
    stubJwks();
    const response = await worker.fetch(await authedRequest(env, url("/api/projects"), { headers: { Origin: env.ALLOWED_ORIGIN } }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(env.ALLOWED_ORIGIN);
    expect(((await response.json()) as Paginated<ProjectSummary>).items).toHaveLength(4);
    close();
  });
  it("serves project detail and 404s for an unknown project", async () => {
    const { env, close } = fixture();
    stubJwks();
    expect((await worker.fetch(await authedRequest(env, url("/api/projects/a1000000-0000-4000-8000-000000000002")), env)).status).toBe(200);
    expect((await worker.fetch(await authedRequest(env, url("/api/projects/d1000000-0000-4000-8000-000000000009")), env)).status).toBe(404);
    close();
  });
  it("serves HEAD without a body", async () => {
    const { env, close } = fixture();
    stubJwks();
    const response = await worker.fetch(await authedRequest(env, url("/api/projects"), { method: "HEAD" }), env);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    close();
  });
  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects authenticated %s with 405", async (method) => {
    const { env, close } = fixture();
    stubJwks();
    const response = await worker.fetch(await authedRequest(env, url("/api/projects"), { method }), env);
    expect(response.status).toBe(405);
    close();
  });
  it("hides internal errors behind a generic 500", async () => {
    const { env, close } = fixture();
    stubJwks();
    const broken = { ...env, MCT_DB: { prepare: () => { throw new Error("secret database detail"); } } as unknown as D1Database };
    const response = await worker.fetch(await authedRequest(env, url("/api/projects")), broken);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
    close();
  });
});

describe("routing and CORS", () => {
  it("returns 404 for unknown routes", async () => {
    const { env, close } = fixture();
    const response = await worker.fetch(new Request(url("/api/other")), env);
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    close();
  });
  it("rejects requests from other origins before routing", async () => {
    const { env, close } = fixture();
    for (const path of ["/api/health", "/api/projects"]) {
      const response = await worker.fetch(new Request(url(path), { headers: { Origin: "https://evil.example" } }), env);
      expect(response.status).toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
    close();
  });
  it("answers preflight for the allowed origin without authentication", async () => {
    const { env, close } = fixture();
    const response = await worker.fetch(new Request(url("/api/projects"), { method: "OPTIONS", headers: { Origin: env.ALLOWED_ORIGIN } }), env);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(env.ALLOWED_ORIGIN);
    close();
  });
});
