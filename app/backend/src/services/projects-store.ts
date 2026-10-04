import type { Milestone, Paginated, ProjectDetail, ProjectPhase, ProjectStatus, ProjectSummary } from "@municipal-tracker/shared";
import { minorUnits } from "@municipal-tracker/shared";

// The scaffold serves one fixed demonstration tenant; tenant_id stays on every query for future multi-agency use.
export const TENANT_ID = "7f3c2a10-5b1e-4c64-9a0d-2e8f6b1d4a01";

export class InvalidCursorError extends Error {}

export interface ListProjectsOptions {
  phase?: ProjectPhase;
  status?: ProjectStatus;
  limit: number;
  cursor?: string;
}

interface ProjectRow {
  id: string;
  project_number: string;
  name: string;
  description: string;
  phase: ProjectPhase;
  status: ProjectStatus;
  department: string;
  approved_budget_minor: number;
  currency_code: string;
  planned_start_date: string | null;
  planned_completion_date: string | null;
  created_at: string;
  updated_at: string;
}

interface MilestoneRow {
  id: string;
  name: string;
  sequence: number;
  planned_date: string | null;
  actual_date: string | null;
  status: Milestone["status"];
}

const PROJECT_COLUMNS = "id, project_number, name, description, phase, status, department, approved_budget_minor, currency_code, planned_start_date, planned_completion_date, created_at, updated_at";
const CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const CURSOR_ID = /^[0-9a-f-]{36}$/;

export function encodeCursor(createdAt: string, id: string): string {
  return btoa(`${createdAt}|${id}`).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } {
  let decoded: string;
  try {
    decoded = atob(cursor.replaceAll("-", "+").replaceAll("_", "/"));
  } catch {
    throw new InvalidCursorError("Cursor is not valid base64url.");
  }
  const [createdAt = "", id = "", ...extra] = decoded.split("|");
  if (extra.length > 0 || !CURSOR_TIMESTAMP.test(createdAt) || !CURSOR_ID.test(id)) throw new InvalidCursorError("Cursor is malformed.");
  return { createdAt, id };
}

function toSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    projectNumber: row.project_number,
    name: row.name,
    phase: row.phase,
    status: row.status,
    department: row.department,
    approvedBudget: minorUnits(row.approved_budget_minor),
    currencyCode: row.currency_code,
    plannedStartDate: row.planned_start_date,
    plannedCompletionDate: row.planned_completion_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(db: D1Database, options: ListProjectsOptions): Promise<Paginated<ProjectSummary>> {
  const conditions = ["tenant_id = ?", "deleted_at IS NULL"];
  const values: (string | number)[] = [TENANT_ID];
  if (options.phase) { conditions.push("phase = ?"); values.push(options.phase); }
  if (options.status) { conditions.push("status = ?"); values.push(options.status); }
  if (options.cursor) {
    const { createdAt, id } = decodeCursor(options.cursor);
    conditions.push("(created_at > ? OR (created_at = ? AND id > ?))");
    values.push(createdAt, createdAt, id);
  }
  // One extra row reveals whether another page exists.
  const sql = `SELECT ${PROJECT_COLUMNS} FROM projects WHERE ${conditions.join(" AND ")} ORDER BY created_at, id LIMIT ?`;
  const { results } = await db.prepare(sql).bind(...values, options.limit + 1).all<ProjectRow>();
  const page = results.slice(0, options.limit);
  return {
    items: page.map(toSummary),
    nextCursor: results.length > options.limit ? encodeCursor(page[options.limit - 1]!.created_at, page[options.limit - 1]!.id) : null,
  };
}

export async function getProject(db: D1Database, id: string): Promise<ProjectDetail | null> {
  const row = await db.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`)
    .bind(TENANT_ID, id).first<ProjectRow>();
  if (!row) return null;
  const { results } = await db.prepare("SELECT id, name, sequence, planned_date, actual_date, status FROM project_milestones WHERE tenant_id = ? AND project_id = ? ORDER BY sequence")
    .bind(TENANT_ID, id).all<MilestoneRow>();
  const milestones: Milestone[] = results.map((milestone) => ({
    id: milestone.id,
    name: milestone.name,
    sequence: milestone.sequence,
    plannedDate: milestone.planned_date,
    actualDate: milestone.actual_date,
    status: milestone.status,
  }));
  return { ...toSummary(row), description: row.description, milestones };
}
