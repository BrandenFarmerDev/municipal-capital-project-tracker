import { describe, expect, it } from "vitest";
import { formatBudget, formatDate, labelFor } from "./format";

describe("format helpers", () => {
  it("formats date-only values without shifting the day", () => {
    expect(formatDate("2027-02-15")).toBe("Feb 15, 2027");
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  });
  it("shows a placeholder for missing dates", () => expect(formatDate(null)).toBe("Not set"));
  it("does not crash or silently normalize invalid calendar dates", () => {
    expect(formatDate("2026-02-30")).toBe("Unavailable");
    expect(formatDate("bad-date")).toBe("Unavailable");
  });
  it("formats budgets with the shared money formatter", () => expect(formatBudget(485000000, "USD")).toBe("$4,850,000.00"));
  it("falls back for unsupported currencies or invalid amounts", () => {
    expect(formatBudget(100, "EUR")).toBe("Unavailable");
    expect(formatBudget(1.5, "USD")).toBe("Unavailable");
  });
  it("humanizes enumerated values", () => {
    expect(labelFor("on_track")).toBe("On track");
    expect(labelFor("construction")).toBe("Construction");
  });
});
