import { describe, expect, it } from "vitest";
import { auditDependencies, validateAuditResult } from "./audit.mjs";
import { vi } from "vitest";

const result = (vulnerabilities: Record<string, number>, status = 0) => ({
  status,
  stdout: JSON.stringify({ metadata: { vulnerabilities } }),
});

describe("dependency audit parsing", () => {
  it("accepts a valid zero-vulnerability report", () => {
    expect(validateAuditResult(result({ total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 })).exitCode).toBe(0);
  });
  it("fails for findings at any severity or a nonzero npm exit", () => {
    expect(validateAuditResult(result({ total: 1, critical: 1, high: 0, moderate: 0, low: 0, info: 0 })).exitCode).toBe(1);
    expect(validateAuditResult(result({ total: 0 }, 1)).exitCode).toBe(1);
  });
  it("fails closed on malformed, incomplete, or errored audit output", () => {
    expect(() => validateAuditResult({ status: 0, stdout: "not json" })).toThrow(/valid JSON/);
    expect(() => validateAuditResult({ status: 0, stdout: "{}" })).toThrow(/valid report/);
    expect(() => validateAuditResult({ error: new Error("npm unavailable") })).toThrow(/npm unavailable/);
  });
  it("runs npm audit and sets a failing exit code for reported vulnerabilities", () => {
    const previousExitCode = process.exitCode;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const run = vi.fn(() => ({ status: 1, stdout: JSON.stringify({ metadata: { vulnerabilities: { total: 1, high: 1 } } }) }));
    try {
      auditDependencies(run);
      expect(run).toHaveBeenCalledWith(process.execPath, [process.env.npm_execpath, "audit", "--json"]);
      expect(process.exitCode).toBe(1);
      expect(log).toHaveBeenCalledOnce();
    } finally {
      process.exitCode = previousExitCode;
      log.mockRestore();
    }
  });
});
