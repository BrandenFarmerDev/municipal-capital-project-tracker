import { describe, expect, it } from "vitest";
import type { Paginated, ProjectDetail, ProjectSummary } from "@municipal-tracker/shared";
import { projectsRoute } from "./projects";
import { fixture } from "../test/fixtures";
import { encodeCursor } from "../services/projects-store";

const get = (path: string, method = "GET") => new Request(`https://api.example.com${path}`, { method });
const FIRST = "a1000000-0000-4000-8000-000000000001";

describe("GET /api/projects", () => {
  it("lists projects with a default page size", async () => {
    const { env, close } = fixture();
    const response = await projectsRoute(get("/api/projects"), env);
    expect(response.status).toBe(200);
    const body = await response.json() as Paginated<ProjectSummary>;
    expect(body.items).toHaveLength(4);
    expect(body.nextCursor).toBeNull();
    close();
  });
  it("filters and paginates", async () => {
    const { env, close } = fixture();
    const filtered = await (await projectsRoute(get("/api/projects?phase=construction&status=on_track"), env)).json() as Paginated<ProjectSummary>;
    expect(filtered.items.map((item) => item.projectNumber)).toEqual(["CIP-DEMO-001"]);
    const first = await (await projectsRoute(get("/api/projects?limit=2"), env)).json() as Paginated<ProjectSummary>;
    const second = await (await projectsRoute(get(`/api/projects?limit=2&cursor=${first.nextCursor}`), env)).json() as Paginated<ProjectSummary>;
    expect([...first.items, ...second.items]).toHaveLength(4);
    close();
  });
  it.each([
    ["/api/projects?phase=bogus", "invalid_phase"],
    ["/api/projects?status=complete", "invalid_status"],
    ["/api/projects?limit=0", "invalid_limit"],
    ["/api/projects?limit=51", "invalid_limit"],
    ["/api/projects?limit=abc", "invalid_limit"],
    ["/api/projects?cursor=bad!", "invalid_cursor"],
    [`/api/projects?cursor=${encodeCursor("2026-99-99T99:99:99Z", FIRST)}`, "invalid_cursor"],
    [`/api/projects?cursor=${encodeCursor("2026-02-29T08:00:00Z", FIRST)}`, "invalid_cursor"],
    [`/api/projects?cursor=${encodeCursor("2026-10-01T08:00:00Z", "-".repeat(36))}`, "invalid_cursor"],
  ])("rejects %s", async (path, code) => {
    const { env, close } = fixture();
    const response = await projectsRoute(get(path), env);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: code });
    close();
  });
});

describe("GET /api/projects/:id", () => {
  it("returns detail with milestones", async () => {
    const { env, close } = fixture();
    const response = await projectsRoute(get(`/api/projects/${FIRST}`), env);
    expect(response.status).toBe(200);
    expect(((await response.json()) as ProjectDetail).milestones).toHaveLength(3);
    close();
  });
  it("accepts an uppercase identifier", async () => {
    const { env, close } = fixture();
    expect((await projectsRoute(get(`/api/projects/${FIRST.toUpperCase()}`), env)).status).toBe(200);
    close();
  });
  it.each(["/api/projects/not-a-uuid", `/api/projects/${FIRST}/milestones`, "/api/projects/d1000000-0000-4000-8000-000000000009"])("returns 404 for %s", async (path) => {
    const { env, close } = fixture();
    expect((await projectsRoute(get(path), env)).status).toBe(404);
    close();
  });
});

describe("methods", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects %s with 405", async (method) => {
    const { env, close } = fixture();
    const response = await projectsRoute(get("/api/projects", method), env);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toContain("GET");
    close();
  });
  it("serves HEAD like GET", async () => {
    const { env, close } = fixture();
    expect((await projectsRoute(get("/api/projects", "HEAD"), env)).status).toBe(200);
    close();
  });
});
