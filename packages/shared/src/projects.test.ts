import { describe, expect, it } from "vitest";
import { isProjectPhase, isProjectStatus, MILESTONE_STATUSES, PROJECT_PHASES, PROJECT_STATUSES } from "./projects";

describe("project vocabularies", () => {
  it("keeps the lifecycle order stable", () => {
    expect(PROJECT_PHASES).toEqual(["request", "planning", "design", "procurement", "construction", "closeout", "complete"]);
    expect(PROJECT_STATUSES).toEqual(["on_track", "at_risk", "delayed", "on_hold", "cancelled"]);
    expect(MILESTONE_STATUSES).toContain("complete");
  });
  it("guards phases", () => {
    expect(isProjectPhase("design")).toBe(true);
    expect(isProjectPhase("Design")).toBe(false);
    expect(isProjectPhase(undefined)).toBe(false);
  });
  it("guards statuses", () => {
    expect(isProjectStatus("at_risk")).toBe(true);
    expect(isProjectStatus("complete")).toBe(false);
    expect(isProjectStatus(3)).toBe(false);
  });
});
