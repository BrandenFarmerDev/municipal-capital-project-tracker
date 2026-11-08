import { afterEach, describe, expect, it, vi } from "vitest";
import { performance } from "node:perf_hooks";
import { protectRequest } from "./request-protection";
import worker from "../index";
import { fixture } from "../test/fixtures";
import * as security from "./security";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const request = (ip?: string, path = "/api/health", init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  if (ip !== undefined) headers.set("CF-Connecting-IP", ip);
  return new Request(`https://api.example.com${path}`, { ...init, headers });
};

describe("API request protection", () => {
  it("uses one fixed digest key unaffected by caller-selected routing and identity", async () => {
    const { env, close } = fixture();
    const digest = vi.spyOn(crypto.subtle, "digest");
    await protectRequest(request("192.0.2.4"), env);
    await protectRequest(request("192.0.2.4", "/unknown?key=other", { method: "DELETE", headers: { "X-Forwarded-For": "203.0.113.9", "X-Real-IP": "203.0.113.10", "Cf-Access-Jwt-Assertion": "secret" } }), env);
    expect(digest).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(env.API_RATE_LIMITER.limit).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![0].key).toMatch(/^api:v1:[a-f0-9]{64}$/);
    expect(calls[1]![0]).toEqual(calls[0]![0]);
    close();
  });

  it("canonicalizes equivalent IPv6 literals and separates distinct valid addresses", async () => {
    const { env, close } = fixture();
    for (const ip of ["2001:0DB8:0000:0000:0000:0000:0000:0001", "2001:db8::1", "192.0.2.4", "192.0.2.5", "::ffff:192.0.2.4", "::ffff:c000:204"]) await protectRequest(request(ip), env);
    const keys = vi.mocked(env.API_RATE_LIMITER.limit).mock.calls.map(([input]) => input.key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[3]);
    expect(keys[4]).toBe(keys[5]);
    close();
  });

  it("collapses all absent, invalid, and oversized address metadata into one bucket", async () => {
    const { env, close } = fixture();
    for (const ip of [undefined, "", "unknown", "192.00.2.4", "256.0.0.1", "1.2.3", "192.0.2.1:443", "[::1]", "fe80::1%eth0", "1.2.3.4,5.6.7.8", "2001: db8::1", ":", "a".repeat(46)]) await protectRequest(request(ip), env);
    const keys = vi.mocked(env.API_RATE_LIMITER.limit).mock.calls.map(([input]) => input.key);
    expect(new Set(keys).size).toBe(1);
    close();
  });

  it.each([undefined, null, {}, { success: 1 }, { success: "true" }])("fails closed for malformed results: %j", async (value) => {
    const { env, close } = fixture();
    vi.mocked(env.API_RATE_LIMITER.limit).mockResolvedValue(value as unknown as RateLimitOutcome);
    const response = await protectRequest(request(), env);
    expect(response!.status).toBe(503);
    expect(await response!.json()).toMatchObject({ error: "rate_limit_unavailable" });
    expect(response!.headers.get("Retry-After")).toBe("60");
    close();
  });

  it.each(["missing", "throw", "reject"])("fails closed when the binding is %s", async (mode) => {
    const { env, close } = fixture();
    if (mode === "missing") Reflect.deleteProperty(env, "API_RATE_LIMITER");
    else vi.mocked(env.API_RATE_LIMITER.limit).mockImplementation(() => {
      if (mode === "throw") throw new Error("private provider message");
      return Promise.reject(new Error("private provider message"));
    });
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await protectRequest(request("192.0.2.4", "/secret?token=private"), env);
    expect(response!.status).toBe(503);
    expect(log).toHaveBeenCalledTimes(1);
    const event: unknown = JSON.parse(log.mock.calls[0]![0] as string);
    expect(event).toEqual({ event: "api_request_guard", status: 503, outcome: "unavailable", reason: mode === "missing" ? "binding_missing" : "binding_failure" });
    close();
  });

  it.each(["resolve", "reject"])("times out without late dispatch when the native call later %ss", async (mode) => {
    const { env, close } = fixture();
    // Finish the real digest before switching to deterministic deadline time.
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("synthetic"));
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(hash);
    vi.useFakeTimers();
    let resolve!: (value: RateLimitOutcome) => void;
    let reject!: (error: Error) => void;
    vi.mocked(env.API_RATE_LIMITER.limit).mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no; }));
    const db = vi.spyOn(env.MCT_DB, "prepare");
    const authorize = vi.spyOn(security, "authorize");
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    let settled = false;
    const pending = worker.fetch(request("192.0.2.1", "/api/projects", { method: "POST", body: "private" }), env).then((response) => { settled = true; return response; });
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(vi.getTimerCount()).toBe(0);
    if (mode === "resolve") resolve({ success: true });
    else reject(new Error("late private failure"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(db).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    close();
  });

  it("keeps synthetic warmed guard p95 below 10ms without business work", async () => {
    const { env, close } = fixture();
    const input = request("192.0.2.4");
    for (let i = 0; i < 30; i++) await protectRequest(input, env);
    const samples: number[] = [];
    for (let i = 0; i < 200; i++) {
      const start = performance.now();
      expect(await protectRequest(input, env)).toBeNull();
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    console.info(JSON.stringify({ benchmark: "synthetic_guard", samples: samples.length, p50Ms: samples[99], p95Ms: samples[189], maxMs: samples[199], node: process.version }));
    expect(samples[189]).toBeLessThan(10);
    close();
  });
});

describe("guard ordering and HTTP boundaries", () => {
  it.each(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE", "BREW"])("blocks %s on every route before auth, body reads, and database effects", async (method) => {
    const { env, close } = fixture();
    vi.mocked(env.API_RATE_LIMITER.limit).mockResolvedValue({ success: false });
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const db = vi.spyOn(env.MCT_DB, "prepare");
    const authorize = vi.spyOn(security, "authorize");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const path of ["/api/health", "/api/projects", "/api/projects/other", "/unknown"]) {
      const input = request("192.0.2.4", path, { method, headers: { Origin: env.ALLOWED_ORIGIN, "Cf-Access-Jwt-Assertion": "private" } });
      const body = vi.spyOn(input, "json");
      const response = await worker.fetch(input, env);
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(env.ALLOWED_ORIGIN);
      expect(response.headers.get("Access-Control-Expose-Headers")).toContain("Retry-After");
      if (method === "HEAD") expect(await response.text()).toBe("");
      else expect(await response.json()).toMatchObject({ error: "rate_limited" });
      expect(body).not.toHaveBeenCalled();
    }
    expect(env.API_RATE_LIMITER.limit).toHaveBeenCalledTimes(4);
    expect(network).not.toHaveBeenCalled();
    expect(db).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
    close();
  });

  it("counts and denies forbidden origins before origin handling without granting CORS", async () => {
    const { env, close } = fixture();
    vi.mocked(env.API_RATE_LIMITER.limit).mockResolvedValue({ success: false });
    const response = await worker.fetch(request("192.0.2.1", "/api/health", { headers: { Origin: "https://evil.example" } }), env);
    expect(response.status).toBe(429);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(env.API_RATE_LIMITER.limit).toHaveBeenCalledTimes(1);
    close();
  });
});
