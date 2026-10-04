import type { MinorUnits } from "./money";

export const PROJECT_PHASES = ["request", "planning", "design", "procurement", "construction", "closeout", "complete"] as const;
export const PROJECT_STATUSES = ["on_track", "at_risk", "delayed", "on_hold", "cancelled"] as const;
export const MILESTONE_STATUSES = ["planned", "in_progress", "complete", "delayed"] as const;

export type ProjectPhase = (typeof PROJECT_PHASES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface Milestone {
  id: string;
  name: string;
  sequence: number;
  plannedDate: string | null;
  actualDate: string | null;
  status: MilestoneStatus;
}

export interface ProjectSummary {
  id: string;
  projectNumber: string;
  name: string;
  phase: ProjectPhase;
  status: ProjectStatus;
  department: string;
  approvedBudget: MinorUnits;
  currencyCode: string;
  plannedStartDate: string | null;
  plannedCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  description: string;
  milestones: Milestone[];
}

export function isProjectPhase(value: unknown): value is ProjectPhase {
  return (PROJECT_PHASES as readonly unknown[]).includes(value);
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly unknown[]).includes(value);
}
