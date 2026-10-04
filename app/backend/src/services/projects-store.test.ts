import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, getProject, InvalidCursorError, listProjects, TENANT_ID } from "./projects-store";
import { fixture } from "../test/fixtures";

const NUMBERS = ["CIP-DEMO-001", "CIP-DEMO-002", "CIP-DEMO-003", "CIP-DEMO-004"];
const OTHER_TENANT = "11111111-1111-4111-8111-111111111111";

describe("cursor encoding", () => {
  it("round-trips as opaque base64url", () => {
    const cursor = encodeCursor("2026-10-01T08:00:00Z", "a1000000-0000-4000-8000-000000000001");
    expect(cursor).toMatch(/^[\w-]+$/);
    expect(decodeCursor(cursor)).toEqual({ createdAt: "2026-10-01T08:00:00Z", id: "a1000000-0000-4000-8000-000000000001" });
  });
  it.each([
    ["not base64", "!!!"],
    ["no separator", btoa("2026-10-01T08:00:00Z")],
    ["extra separator", btoa("2026-10-01T08:00:00Z|a1000000-0000-4000-8000-000000000001|x")],
    ["a bad timestamp", btoa("yesterday|a1000000-0000-4000-8000-000000000001")],
    ["a bad id", btoa("2026-10-01T08:00:00Z|short")],
  ])("rejects %s", (_name, cursor) => expect(() => decodeCursor(cursor)).toThrow(InvalidCursorError));
});

describe("listProjects", () => {
  it("lists active projects in stable creation order", async () => {
    const { db, close } = fixture();
    const page = await listProjects(db, { limit: 25 });
    expect(page.items.map((item) => item.projectNumber)).toEqual(NUMBERS);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject({ approvedBudget: 485000000, currencyCode: "USD", phase: "construction" });
    close();
  });
  it("filters by phase and status", async () => {
    const { db, close } = fixture();
    expect((await listProjects(db, { limit: 25, phase: "design" })).items.map((item) => item.projectNumber)).toEqual(["CIP-DEMO-002"]);
    expect((await listProjects(db, { limit: 25, status: "delayed" })).items.map((item) => item.projectNumber)).toEqual(["CIP-DEMO-003"]);
    expect((await listProjects(db, { limit: 25, phase: "design", status: "delayed" })).items).toEqual([]);
    close();
  });
  it("pages with an opaque cursor without gaps or repeats", async () => {
    const { db, close } = fixture();
    const first = await listProjects(db, { limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).not.toBeNull();
    const second = await listProjects(db, { limit: 3, cursor: first.nextCursor! });
    expect(second.items.map((item) => item.projectNumber)).toEqual(["CIP-DEMO-004"]);
    expect(second.nextCursor).toBeNull();
    close();
  });
  it("breaks created_at ties by id", async () => {
    const { db, raw, close } = fixture();
    raw.exec(`UPDATE projects SET created_at = '2026-10-01T08:00:00Z'`);
    const first = await listProjects(db, { limit: 2 });
    const second = await listProjects(db, { limit: 2, cursor: first.nextCursor! });
    expect([...first.items, ...second.items].map((item) => item.projectNumber)).toEqual(NUMBERS);
    close();
  });
  it("hides soft-deleted projects and other tenants", async () => {
    const { db, raw, close } = fixture();
    raw.exec("UPDATE projects SET deleted_at = '2026-10-02T00:00:00Z' WHERE project_number = 'CIP-DEMO-001'");
    raw.exec(`INSERT INTO tenants (id, name, slug, created_at, updated_at) VALUES ('${OTHER_TENANT}', 'Other', 'other', 'x', 'x')`);
    raw.exec(`INSERT INTO projects (id, tenant_id, project_number, name, phase, status, department, approved_budget_minor, created_at, updated_at, created_by, updated_by)
      VALUES ('c1000000-0000-4000-8000-000000000001', '${OTHER_TENANT}', 'X-1', 'Other', 'request', 'on_track', 'D', 1, '2026-10-01T09:00:00Z', 'x', 't', 't')`);
    expect((await listProjects(db, { limit: 25 })).items.map((item) => item.projectNumber)).toEqual(NUMBERS.slice(1));
    close();
  });
  it("rejects malformed cursors", async () => {
    const { db, close } = fixture();
    await expect(listProjects(db, { limit: 5, cursor: "bad!" })).rejects.toBeInstanceOf(InvalidCursorError);
    close();
  });
  it("uses the tenant list index", async () => {
    const { raw, close } = fixture();
    const plan = raw.prepare("EXPLAIN QUERY PLAN SELECT id FROM projects WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at, id").all(TENANT_ID);
    expect(JSON.stringify(plan)).toContain("idx_projects_tenant_list");
    close();
  });
});

describe("getProject", () => {
  it("returns detail with milestones in sequence order", async () => {
    const { db, close } = fixture();
    const { items } = await listProjects(db, { limit: 1 });
    const project = await getProject(db, items[0]!.id);
    expect(project?.description).toContain("fictional");
    expect(project?.milestones.map((milestone) => milestone.sequence)).toEqual([1, 2, 3]);
    expect(project?.milestones[2]).toMatchObject({ status: "in_progress", actualDate: null });
    close();
  });
  it("returns an empty milestone list when none exist", async () => {
    const { db, raw, close } = fixture();
    raw.exec("DELETE FROM project_milestones");
    expect((await getProject(db, "a1000000-0000-4000-8000-000000000001"))?.milestones).toEqual([]);
    close();
  });
  it("returns null for unknown or soft-deleted projects", async () => {
    const { db, raw, close } = fixture();
    expect(await getProject(db, "d1000000-0000-4000-8000-000000000009")).toBeNull();
    raw.exec("UPDATE projects SET deleted_at = '2026-10-02T00:00:00Z' WHERE id = 'a1000000-0000-4000-8000-000000000001'");
    expect(await getProject(db, "a1000000-0000-4000-8000-000000000001")).toBeNull();
    close();
  });
});
