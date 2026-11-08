import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, errorMessage, getApiHealth, getProject, listProjects } from "./api";
import { detail, health, summary } from "../test/fixtures";
import { apiJson, stubApi } from "../test/render";

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it.each([200, 429, 503].flatMap((status) => ["caller", "timeout"].map((source) => ({ status, source }))))("preserves $source cancellation during deferred $status response-body decoding", async ({ status, source }) => {
    const caller = new AbortController();
    const timeout = new AbortController();
    const timeoutSignal = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    let body!: ReadableStreamDefaultController<Uint8Array>;
    const response = new Response(new ReadableStream<Uint8Array>({ start(controller) { body = controller; } }), { status });
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init: RequestInit) => {
      init.signal!.addEventListener("abort", () => body.error(new DOMException("Body read aborted", "AbortError")), { once: true });
      return response;
    });
    vi.stubGlobal("fetch", fetcher);
    const outcome = getApiHealth(caller.signal).catch((reason: unknown) => reason);
    await vi.waitFor(() => expect(response.bodyUsed).toBe(true));
    const reason = source === "caller" ? new Error("Caller cancelled the request") : new DOMException("Request deadline elapsed", "TimeoutError");
    (source === "caller" ? caller : timeout).abort(reason);
    expect(await outcome).toBe(reason);
    expect(fetcher).toHaveBeenCalledTimes(1);
    timeoutSignal.mockRestore();
  });
  it.each([200, 429, 503].flatMap((status) => ["AbortError", "TimeoutError"].map((name) => ({ status, name }))))("preserves body-reader $name on $status even without an aborted signal", async ({ status, name }) => {
    const reason = new DOMException("Body reader cancelled", name);
    const response = new Response(null, { status });
    vi.spyOn(response, "json").mockRejectedValue(reason);
    const fetcher = stubApi(() => response);
    await expect(getApiHealth()).rejects.toBe(reason);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["json", "html"])("handles readable %s 429 without retrying or displaying the response body", async (kind) => {
    const fetcher = stubApi(() => kind === "json" ? apiJson({ error: "rate_limited" }, 429) : new Response("<html>private marker</html>", { status: 429 }));
    await expect(getProject("x")).rejects.toThrow("Wait at least 60 seconds");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("explains pre-dispatch limiter outages with manual recovery", async () => {
    const fetcher = stubApi(() => apiJson({ error: "rate_limit_unavailable" }, 503));
    await expect(getApiHealth()).rejects.toThrow("try again manually");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not expose an unreadable Retry-After value or edge HTML", async () => {
    const fetcher = stubApi(() => new Response("<html>private marker</html>", { status: 429, headers: { "Retry-After": "private marker" } }));
    const error: unknown = await getApiHealth().catch((reason: unknown) => reason);
    expect(errorMessage(error)).toContain("try again manually");
    expect(errorMessage(error)).not.toContain("private marker");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("preserves cancellation and does not replay opaque failures", async () => {
    const controller = new AbortController();
    const abort = new DOMException("Cancelled", "AbortError");
    const fetcher = vi.fn().mockRejectedValue(abort);
    vi.stubGlobal("fetch", fetcher);
    const pending = getApiHealth(controller.signal);
    controller.abort();
    await expect(pending).rejects.toBe(abort);
    expect((fetcher.mock.calls[0]![1] as RequestInit).signal!.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockRejectedValue(new TypeError("Failed to fetch"));
    const reason: unknown = await getApiHealth().catch((error: unknown) => error);
    expect(errorMessage(reason)).toContain("Check your connection");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
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
