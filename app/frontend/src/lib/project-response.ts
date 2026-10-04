import { isProjectPhase, isProjectStatus, MILESTONE_STATUSES, type Milestone, type ProjectDetail, type ProjectSummary } from "@municipal-tracker/shared";

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const nullableDate = (value: unknown) => value === null || isDateOnly(value);
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function isProjectSummary(value: unknown): value is ProjectSummary {
  if (!record(value)) return false;
  return ["id", "projectNumber", "name", "department"].every((key) => typeof value[key] === "string")
    && isProjectPhase(value.phase) && isProjectStatus(value.status)
    && typeof value.approvedBudget === "number" && Number.isSafeInteger(value.approvedBudget) && value.approvedBudget >= 0
    && value.currencyCode === "USD" && nullableDate(value.plannedStartDate) && nullableDate(value.plannedCompletionDate)
    && timestamp(value.createdAt) && timestamp(value.updatedAt);
}

function isMilestone(value: unknown): value is Milestone {
  if (!record(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string"
    && typeof value.sequence === "number" && Number.isSafeInteger(value.sequence) && value.sequence > 0
    && (MILESTONE_STATUSES as readonly unknown[]).includes(value.status)
    && nullableDate(value.plannedDate) && nullableDate(value.actualDate);
}

export function isProjectDetail(value: unknown): value is ProjectDetail {
  return isProjectSummary(value) && "description" in value && typeof value.description === "string"
    && "milestones" in value && Array.isArray(value.milestones) && value.milestones.every(isMilestone);
}

export function isProjectPage(value: unknown): value is { items: ProjectSummary[]; nextCursor: string | null } {
  return record(value) && Array.isArray(value.items) && value.items.every(isProjectSummary)
    && (value.nextCursor === null || (typeof value.nextCursor === "string" && value.nextCursor.length > 0));
}
