import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, errorMessage, getApiHealth, getProject, listProjects } from "./api";
import { detail, health, summary } from "../test/fixtures";
import { apiJson, stubApi } from "../test/render";

describe("api client", () => {
  it("reads health with credentials", async () => {
    const fetcher = stubApi();
    expect(await getApiHealth()).toMatchObject({ status: "ok" });
    expect((fetcher.mock.calls[0] as unknown[])[1]).toMatchObject({ credentials: "include" });
  });
  it("rejects an invalid health payload", async () => {
    stubApi(() => apiJson({ ...health, status: "down" }));
    await expect(getApiHealth(new AbortController().signal)).rejects.toThrow("invalid health");
  });
  it("builds list queries from set filters only", async () => {
    const fetcher = stubApi();
    await listProjects({});
    await listProjects({ phase: "design", status: "", cursor: "abc" });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual(["/api/projects", "/api/projects?phase=design&cursor=abc"]);
  });
  it("prefixes the configured API base URL and encodes ids", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const fetcher = stubApi();
    await getProject("a/b");
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://api.example.com/api/projects/a%2Fb");
  });
  it.each([[401, "Sign in"], [404, "not found"], [503, "temporarily unavailable"], [500, "could not be completed"]])("maps %s to a safe message", async (status, text) => {
    stubApi(() => apiJson({ error: "x" }, status));
    const error = await getProject("x").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(status);
    expect((error as Error).message).toContain(text);
  });
  it("describes unknown failures generically", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("x")).toBe("The API is unavailable. Try again shortly.");
  });
  it("explains connection and timeout failures with recovery guidance", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toContain("Check your connection");
    expect(errorMessage(new DOMException("Timed out", "TimeoutError"))).toContain("timed out");
  });
  it("distinguishes owner configuration from a temporary outage", async () => {
    stubApi(() => apiJson({ error: "auth_unconfigured" }, 503));
    await expect(getProject("x")).rejects.toThrow("not configured");
  });
  it("handles non-JSON failure responses", async () => {
    stubApi(() => new Response("Unavailable", { status: 503 }));
    await expect(getProject("x")).rejects.toThrow("temporarily unavailable");
  });
  it("explains an HTML sign-in response without rendering response contents", async () => {
    stubApi(() => new Response("<html>Sign in</html>"));
    await expect(listProjects({})).rejects.toThrow("unreadable response");
  });
  it("normalizes a trailing slash on the API base", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/");
    const fetcher = stubApi();
    await listProjects({});
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://api.example.com/api/projects");
  });
  it.each([
    null, {}, { items: null, nextCursor: null }, { items: [], nextCursor: "" },
    { items: [null], nextCursor: null },
    ...[
      { name: 42 }, { phase: "unknown" }, { status: "unknown" }, { approvedBudget: 1.5 },
      { approvedBudget: -1 }, { approvedBudget: "100" }, { approvedBudget: Number.MAX_SAFE_INTEGER + 1 },
      { currencyCode: "EUR" }, { plannedStartDate: "bad-date" }, { plannedCompletionDate: "2026-02-30" },
      { plannedCompletionDate: "2026-99-99" }, { plannedStartDate: 42 }, { createdAt: "not-a-timestamp" }, { updatedAt: null },
    ].map((values) => ({ items: [{ ...summary(), ...values }], nextCursor: null })),
  ])("rejects malformed project lists rather than crashing the page: %j", async (body) => {
    stubApi(() => apiJson(body));
    await expect(listProjects({})).rejects.toThrow("invalid project list");
  });
  it.each([
    summary(), { ...detail(), description: null }, { ...detail(), milestones: null },
    ...[
      null, {}, { id: "m", name: "Fictional", sequence: 0, status: "planned", plannedDate: null, actualDate: null },
      { id: "m", name: "Fictional", sequence: 1, status: "unknown", plannedDate: null, actualDate: null },
      { id: "m", name: "Fictional", sequence: 1, status: "planned", plannedDate: "2026-02-30", actualDate: null },
    ].map((milestone) => ({ ...detail(), milestones: [milestone] })),
  ])("rejects malformed project details: %j", async (body) => {
    stubApi(() => apiJson(body));
    await expect(getProject("x")).rejects.toThrow("invalid project");
  });
});
