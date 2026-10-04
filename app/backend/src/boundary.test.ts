import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import { projectsRoute } from "./routes/projects";
import { authorize, Problem } from "./services/security";
import { fixture } from "./test/fixtures";

vi.mock("./services/security", async (importOriginal) => ({ ...await importOriginal<typeof import("./services/security")>(), authorize: vi.fn() }));
vi.mock("./routes/projects", () => ({ projectsRoute: vi.fn() }));
afterEach(() => vi.resetAllMocks());

const request = (path: string, method = "GET") => new Request(`https://api.example/api${path}`, { method });

describe("private boundary", () => {
  it("never reaches project handlers without successful authorization", async () => {
    const { env, close } = fixture();
    vi.mocked(authorize).mockRejectedValue(new Problem(401, "authentication_required"));
    for (const path of ["/projects", "/projects/a1000000-0000-4000-8000-000000000001"]) {
      expect((await worker.fetch(request(path), env)).status).toBe(401);
    }
    expect(projectsRoute).not.toHaveBeenCalled();
    close();
  });
  it("authorizes before every protected method, including unsupported ones", async () => {
    const { env, close } = fixture();
    vi.mocked(authorize).mockRejectedValue(new Problem(401, "authentication_required"));
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect((await worker.fetch(request("/projects", method), env)).status).toBe(401);
    expect(projectsRoute).not.toHaveBeenCalled();
    close();
  });
  it("only calls the project handler after authorization succeeds", async () => {
    const { env, close } = fixture();
    vi.mocked(authorize).mockResolvedValue("owner");
    vi.mocked(projectsRoute).mockResolvedValue(Response.json({ ok: true }));
    expect((await worker.fetch(request("/projects"), env)).status).toBe(200);
    expect(authorize).toHaveBeenCalledOnce();
    expect(projectsRoute).toHaveBeenCalledOnce();
    close();
  });
  it("keeps the health route public", async () => {
    const { env, close } = fixture();
    expect((await worker.fetch(request("/health"), env)).status).toBe(200);
    expect(authorize).not.toHaveBeenCalled();
    close();
  });
  it("does not leak handler error details", async () => {
    const { env, close } = fixture();
    vi.mocked(authorize).mockResolvedValue("owner");
    vi.mocked(projectsRoute).mockRejectedValue(new Error("private data"));
    const response = await worker.fetch(request("/projects"), env);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private data");
    close();
  });
});
