-- Additive-only migration. Soft-deleted project_number values stay reserved by design (see docs/architecture.md).
CREATE TABLE app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_metadata (key, value) VALUES ('schema_version', '1');

-- Single fixed demonstration tenant. tenant_id columns remain for future multi-agency extensibility.
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1
);

INSERT INTO tenants (id, name, slug, created_at, updated_at, row_version) VALUES (
  '7f3c2a10-5b1e-4c64-9a0d-2e8f6b1d4a01',
  'High Desert Demonstration Municipality',
  'high-desert-demo',
  '2026-10-01T00:00:00Z',
  '2026-10-01T00:00:00Z',
  1
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id),
  project_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  phase TEXT NOT NULL CHECK (phase IN ('request', 'planning', 'design', 'procurement', 'construction', 'closeout', 'complete')),
  status TEXT NOT NULL CHECK (status IN ('on_track', 'at_risk', 'delayed', 'on_hold', 'cancelled')),
  department TEXT NOT NULL,
  -- typeof(...) = 'integer' rejects REAL storage (e.g. 1.5); the upper bound keeps the value a
  -- JavaScript-safe integer. currency_code is constrained to USD because the shared money helper
  -- (packages/shared/src/money.ts) only supports a two-digit-exponent currency today.
  approved_budget_minor INTEGER NOT NULL CHECK (
    typeof(approved_budget_minor) = 'integer' AND approved_budget_minor BETWEEN 0 AND 9007199254740991
  ),
  currency_code TEXT NOT NULL DEFAULT 'USD' CHECK (currency_code = 'USD'),
  planned_start_date TEXT,
  planned_completion_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  UNIQUE (tenant_id, project_number),
  UNIQUE (tenant_id, id)
);

-- Stable ordering for cursor pagination: (created_at, id) within a tenant's non-deleted rows.
CREATE INDEX idx_projects_tenant_list ON projects (tenant_id, deleted_at, created_at, id);

CREATE TABLE project_milestones (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id),
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  planned_date TEXT,
  actual_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'complete', 'delayed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, project_id, sequence),
  FOREIGN KEY (tenant_id, project_id) REFERENCES projects (tenant_id, id)
);

CREATE INDEX idx_project_milestones_project ON project_milestones (tenant_id, project_id, sequence);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (id),
  actor_subject TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_audit_events_entity ON audit_events (tenant_id, entity_type, entity_id, occurred_at);

CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

-- INSERT OR REPLACE resolves a primary-key conflict with a delete-then-insert, and that delete
-- does not fire audit_events_no_delete when recursive_triggers is off (D1's default). This
-- BEFORE INSERT trigger rejects a reused id outright, so no replacement delete ever happens.
CREATE TRIGGER audit_events_no_replace BEFORE INSERT ON audit_events
WHEN EXISTS (SELECT 1 FROM audit_events WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;
