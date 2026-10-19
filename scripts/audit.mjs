import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function validateAuditResult(result) {
  if (result.error) throw result.error;
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("Dependency audit did not return valid JSON.");
  }
  const vulnerabilities = report.metadata?.vulnerabilities;
  if (report.error || !vulnerabilities || typeof vulnerabilities.total !== "number") {
    throw new Error("Dependency audit did not return a valid report.");
  }
  return { exitCode: result.status !== 0 || vulnerabilities.total !== 0 ? 1 : 0, vulnerabilities };
}

export function auditDependencies(run = (command, args) => spawnSync(command, args, { encoding: "utf8" })) {
  const result = run(process.execPath, [process.env.npm_execpath, "audit", "--json"]);
  const { exitCode, vulnerabilities } = validateAuditResult(result);
  console.log("Dependency vulnerabilities:", vulnerabilities);
  process.exitCode = exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) auditDependencies();
