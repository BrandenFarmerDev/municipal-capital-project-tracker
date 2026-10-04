import { SERVICE_NAME, minorUnits, type Milestone, type ProjectDetail, type ProjectSummary } from "@municipal-tracker/shared";

export const health = { status: "ok", service: SERVICE_NAME, timestamp: "2026-10-01T00:00:00Z" };

export const summary = (overrides: Partial<ProjectSummary> = {}): ProjectSummary => ({
  id: "a1000000-0000-4000-8000-000000000001",
  projectNumber: "CIP-DEMO-001",
  name: "Mesa Street Water Main Replacement (fictional)",
  phase: "construction",
  status: "on_track",
  department: "Public Works (fictional)",
  approvedBudget: minorUnits(485000000),
  currencyCode: "USD",
  plannedStartDate: "2026-03-01",
  plannedCompletionDate: "2027-02-15",
  createdAt: "2026-10-01T08:00:00Z",
  updatedAt: "2026-10-01T08:00:00Z",
  ...overrides,
});

export const milestone = (overrides: Partial<Milestone> = {}): Milestone => ({
  id: "b1000000-0000-4000-8000-000000000001", name: "Design approved", sequence: 1,
  plannedDate: "2026-02-01", actualDate: "2026-02-03", status: "complete", ...overrides,
});

export const detail = (overrides: Partial<ProjectDetail> = {}): ProjectDetail => ({
  ...summary(), description: "Synthetic example project.", milestones: [milestone(), milestone({ id: "m2", name: "Pressure testing", sequence: 2, actualDate: null, status: "in_progress" })], ...overrides,
});
