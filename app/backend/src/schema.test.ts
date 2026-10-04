import { describe, expect, it } from "vitest";
import { createTestD1, readMigration } from "./test/sqlite-d1";
import { SEED_SQL } from "./test/fixtures";

const TENANT = "7f3c2a10-5b1e-4c64-9a0d-2e8f6b1d4a01";
const project = (id: string, number: string, extra = "") => `INSERT INTO projects (id, tenant_id, project_number, name, phase, status, department, approved_budget_minor, created_at, updated_at, created_by, updated_by${extra ? ", " + extra.split("=")[0] : ""})
  VALUES ('${id}', '${TENANT}', '${number}', 'P', 'request', 'on_track', 'D', 1, 't', 't', 'u', 'u'${extra ? ", " + extra.split("=")[1] : ""})`;
const milestone = (id: string, projectId: string, sequence: number, tenant = TENANT) => `INSERT INTO project_milestones (id, tenant_id, project_id, name, sequence, status, created_at, updated_at, created_by, updated_by)
  VALUES ('${id}', '${tenant}', '${projectId}', 'M', ${sequence}, 'planned', 't', 't', 'u', 'u')`;

function columns(raw: ReturnType<typeof createTestD1>["raw"], table: string) {
  return (raw.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name);
}

describe("initial schema", () => {
  it("creates exactly the expected tables with no membership table", () => {
    const { raw, close } = createTestD1();
    const tables = (raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((row) => row.name);
    expect(tables).toEqual(["app_metadata", "audit_events", "project_milestones", "projects", "tenants"]);
    close();
  });
  it("defines the specified columns", () => {
    const { raw, close } = createTestD1();
    expect(columns(raw, "tenants")).toEqual(["id", "name", "slug", "created_at", "updated_at", "row_version"]);
    expect(columns(raw, "projects")).toEqual(["id", "tenant_id", "project_number", "name", "description", "phase", "status", "department", "approved_budget_minor", "currency_code", "planned_start_date", "planned_completion_date", "created_at", "updated_at", "created_by", "updated_by", "row_version", "deleted_at"]);
    expect(columns(raw, "project_milestones")).toEqual(["id", "tenant_id", "project_id", "name", "sequence", "planned_date", "actual_date", "status", "created_at", "updated_at", "created_by", "updated_by", "row_version"]);
    expect(columns(raw, "audit_events")).toEqual(["id", "tenant_id", "actor_subject", "action", "entity_type", "entity_id", "occurred_at", "details_json"]);
    close();
  });
  it("enables foreign keys and defines the pagination and milestone indexes", () => {
    const { raw, close } = createTestD1();
    expect(raw.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    const indexColumns = (name: string) => (raw.prepare(`PRAGMA index_info(${name})`).all() as { name: string }[]).map((column) => column.name);
    expect(indexColumns("idx_projects_tenant_list")).toEqual(["tenant_id", "deleted_at", "created_at", "id"]);
    const unique = (raw.prepare("PRAGMA index_list(project_milestones)").all() as { name: string; unique: number }[]).filter((index) => index.unique);
    expect(unique.map((index) => indexColumns(index.name))).toContainEqual(["tenant_id", "project_id", "sequence"]);
    close();
  });
  it("seeds the schema version and exactly one tenant", () => {
    const { raw, close } = createTestD1();
    expect(raw.prepare("SELECT value FROM app_metadata WHERE key = 'schema_version'").get()).toEqual({ value: "1" });
    expect(raw.prepare("SELECT id, name FROM tenants").all()).toEqual([{ id: TENANT, name: "High Desert Demonstration Municipality" }]);
    close();
  });
  it("enforces uniqueness, including reserved numbers for soft-deleted projects", () => {
    const { raw, close } = createTestD1();
    raw.exec(project("p1", "N-1"));
    expect(() => raw.exec(project("p2", "N-1"))).toThrow(/UNIQUE/);
    raw.exec("UPDATE projects SET deleted_at = 'x' WHERE id = 'p1'");
    expect(() => raw.exec(project("p3", "N-1"))).toThrow(/UNIQUE/);
    raw.exec(milestone("m1", "p1", 1));
    expect(() => raw.exec(milestone("m2", "p1", 1))).toThrow(/UNIQUE/);
    close();
  });
  it("enforces check constraints", () => {
    const { raw, close } = createTestD1();
    expect(() => raw.exec(project("p1", "N-1").replace("'request'", "'bogus'"))).toThrow(/CHECK/);
    expect(() => raw.exec(project("p1", "N-1").replace("'on_track'", "'bogus'"))).toThrow(/CHECK/);
    expect(() => raw.exec(project("p1", "N-1").replace(", 1, 't'", ", -1, 't'"))).toThrow(/CHECK/);
    // typeof(...) = 'integer' rejects REAL storage; the upper bound rejects values past Number's
    // safe-integer range. Both guard the contract that approved_budget_minor is always a safe integer.
    expect(() => raw.exec(project("p1", "N-1").replace(", 1, 't'", ", 1.5, 't'"))).toThrow(/CHECK/);
    expect(() => raw.exec(project("p1", "N-1").replace(", 1, 't'", ", 9007199254740992, 't'"))).toThrow(/CHECK/);
    // currency_code is pinned to USD because the shared money helper only supports that exponent.
    expect(() => raw.exec(project("p1", "N-1", "currency_code='EUR'"))).toThrow(/CHECK/);
    raw.exec(project("p1", "N-1"));
    expect(raw.prepare("SELECT currency_code, row_version FROM projects").get()).toEqual({ currency_code: "USD", row_version: 1 });
    expect(() => raw.exec(milestone("m1", "p1", 0))).toThrow(/CHECK/);
    expect(() => raw.exec(milestone("m1", "p1", 1).replace("'planned'", "'bogus'"))).toThrow(/CHECK/);
    close();
  });
  it("enforces foreign keys including tenant consistency", () => {
    const { raw, close } = createTestD1();
    expect(() => raw.exec(milestone("m1", "missing", 1))).toThrow(/FOREIGN KEY/);
    raw.exec("INSERT INTO tenants (id, name, slug, created_at, updated_at) VALUES ('t2', 'Other', 'other', 'x', 'x')");
    raw.exec(project("p1", "N-1"));
    expect(() => raw.exec(milestone("m1", "p1", 1, "t2"))).toThrow(/FOREIGN KEY/);
    expect(() => raw.exec(project("p2", "N-2").replace(`'${TENANT}'`, "'nope'"))).toThrow(/FOREIGN KEY/);
    close();
  });
  it("keeps audit events append-only", () => {
    const { raw, close } = createTestD1();
    raw.exec(`INSERT INTO audit_events (id, tenant_id, actor_subject, action, entity_type, entity_id, occurred_at) VALUES ('a1', '${TENANT}', 'owner', 'create', 'project', 'p1', 't')`);
    expect(raw.prepare("SELECT details_json FROM audit_events").get()).toEqual({ details_json: "{}" });
    expect(() => raw.exec("UPDATE audit_events SET action = 'x'")).toThrow(/append-only/);
    expect(() => raw.exec("DELETE FROM audit_events")).toThrow(/append-only/);
    // INSERT OR REPLACE resolves a primary-key conflict with a delete-then-insert, and that delete
    // does not fire the no-delete trigger when recursive_triggers is off (D1's default). Without a
    // dedicated guard this would silently overwrite row 'a1' instead of raising.
    expect(() =>
      raw.exec(`INSERT OR REPLACE INTO audit_events (id, tenant_id, actor_subject, action, entity_type, entity_id, occurred_at) VALUES ('a1', '${TENANT}', 'owner', 'replaced', 'project', 'p1', 't')`),
    ).toThrow(/append-only/);
    expect(raw.prepare("SELECT action FROM audit_events WHERE id = 'a1'").get()).toEqual({ action: "create" });
    close();
  });
  it("applies the synthetic local seed idempotently", () => {
    const { raw, close } = createTestD1();
    raw.exec(SEED_SQL);
    raw.exec(SEED_SQL);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM tenants").get()).toEqual({ n: 1 });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM projects").get()).toEqual({ n: 4 });
    expect(raw.prepare("SELECT COUNT(DISTINCT phase) AS n FROM projects").get()).toEqual({ n: 4 });
    expect(SEED_SQL).toContain("fictional");
    expect(readMigration("0001_initial_schema.sql")).not.toContain("tenant_memberships");
    close();
  });
});
