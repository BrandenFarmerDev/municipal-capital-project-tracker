import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { preflight, run, runDeploymentPreflight } from "./deployment-preflight.mjs";
import { assertScannerSucceeded, deploymentArtifactPaths, localBuildArtifactPaths, runScanCli, scan, scanSecrets, sourceFiles, validateSarif, withSourceSnapshot } from "./security-scan.mjs";

const report = (results: unknown[] = [], invocations: unknown[] = [{ executionSuccessful: true }]) => ({
  version: "2.1.0",
  runs: [{ tool: { driver: { name: "CodeQL" } }, results, invocations }],
});

describe("security scan result validation", () => {
  it("accepts a successful empty analysis and rejects unexecuted, malformed, wrong-tool, and finding reports", () => {
    expect(() => validateSarif(report(), "CodeQL", true)).not.toThrow();
    expect(() => validateSarif(report([], []), "CodeQL", true)).toThrow(/does not prove successful/);
    expect(() => validateSarif({}, "CodeQL")).toThrow(/malformed or empty/);
    expect(() => validateSarif({ ...report(), runs: [{ ...report().runs[0], tool: { driver: { name: "Other" } } }] }, "CodeQL")).toThrow(/unexpected tool/);
    expect(() => validateSarif(report([{ ruleId: "js/xss" }]), "CodeQL", true)).toThrow(/1 finding/);
  });

  it("rejects missing SARIF results instead of interpreting them as zero findings", () => {
    const malformed = { ...report(), runs: [{ tool: { driver: { name: "CodeQL" } } }] };
    expect(() => validateSarif(malformed, "CodeQL")).toThrow(/omitted results/);
  });

  it("fails closed when a scanner is missing or exits unsuccessfully", () => {
    expect(() => assertScannerSucceeded({ error: new Error("not installed") }, "gitleaks")).toThrow(/unavailable/);
    expect(() => assertScannerSucceeded({ status: 2, stderr: "invalid report" }, "codeql")).toThrow(/failed \(2\): invalid report/);
    expect(() => assertScannerSucceeded({ status: 0, stderr: "" }, "codeql")).not.toThrow();
  });

  it("scans named artifacts, parses redacted reports, and rejects malformed scanner output", async () => {
    const commands: string[] = [];
    const dependencies = {
      runScanner: (command: string, args: string[]) => { commands.push(`${command} ${args.join(" ")}`); },
      readSarif: async (path: string) => JSON.stringify(path.includes("gitleaks")
        ? { ...report([], []), runs: [{ ...report().runs[0], tool: { driver: { name: "gitleaks" } } }] }
        : report()),
      makeReportDirectory: async () => {},
    };
    await scanSecrets(["app/backend/dist/preview", "app/frontend/dist"], dependencies);
    expect(commands[0]).toContain("--redact");
    expect(commands[0]).toContain("app/backend/dist/preview");
    commands.length = 0;
    await scan(["app", "packages"], dependencies);
    expect(commands).toHaveLength(4);
    expect(commands[3]).toContain("javascript-queries@2.4.7:codeql-suites/javascript-security-extended.qls");
    let codeqlRun = false;
    await expect(scan(["app"], { ...dependencies, runScanner(command: string) { if (command.includes("codeql")) codeqlRun = true; else throw new Error("gitleaks failure"); } })).rejects.toThrow(/gitleaks failure/);
    expect(codeqlRun).toBe(false);
    await expect(scanSecrets(["app"], { ...dependencies, readSarif: async () => "not JSON" })).rejects.toThrow();
    await expect(scan([])).rejects.toThrow(/non-empty list/);
  });

  it("scans generated Worker and frontend outputs in local quality and blocks on a Worker finding", async () => {
    expect(localBuildArtifactPaths()).toEqual(["app/backend/dist", "app/frontend/dist"]);
    const commands: string[][] = [];
    await expect(runScanCli(["--local-build-artifacts"], undefined, {
      runScanner(_command, args) { commands.push(args); },
      readSarif: async () => JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "gitleaks" } }, results: [{ ruleId: "fixture-worker-secret" }] }] }),
      makeReportDirectory: async () => {},
    })).rejects.toThrow(/finding/);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toContain("app/backend/dist");
  });

  it("selects environment-specific artifacts and fails closed on an invalid environment", async () => {
    expect(deploymentArtifactPaths("production")).toEqual(["app/backend/dist/production", "app/frontend/dist"]);
    expect(() => deploymentArtifactPaths("staging")).toThrow(/preview or production/);
    let scannedArgs: string[] = [];
    const dependencies = {
      runScanner(_command: string, args: string[]) { scannedArgs = args; },
      readSarif: async () => JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "gitleaks" } }, results: [] }] }),
      makeReportDirectory: async () => {},
    };
    await runScanCli(["--secrets-only"], "preview", dependencies);
    await runScanCli(["--secrets-only", "app/frontend/dist"], "preview", dependencies);
    expect(scannedArgs).toContain("app/frontend/dist");
    const script = fileURLToPath(new URL("./security-scan.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script, "--secrets-only"], { encoding: "utf8", env: { ...process.env, DEPLOY_ENVIRONMENT: "invalid" } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Security scan blocked");
  });

  it("snapshots eligible files without traversing ignored tools and rejects unsafe names", async () => {
    const result = await sourceFiles((args) => {
      expect(args).toContain("--exclude-standard");
      return { status: 0, stdout: "src/app.ts\0scripts/check.mjs\0" };
    });
    expect(result).toEqual(["src/app.ts", "scripts/check.mjs"]);
    const fixtures = await mkdtemp(join(tmpdir(), "mct-scan-fixtures-"));
    let snapshot: string | undefined;
    try {
      await mkdir(join(fixtures, "src"), { recursive: true });
      await mkdir(join(fixtures, "scripts"), { recursive: true });
      await writeFile(join(fixtures, "src/app.ts"), "export const source = true;\n");
      await writeFile(join(fixtures, "scripts/check.mjs"), "export const check = true;\n");
      await withSourceSnapshot(async (root) => {
        snapshot = root;
        expect(await readFile(join(root, "src/app.ts"), "utf8")).toContain("source = true");
        expect(await readFile(join(root, "scripts/check.mjs"), "utf8")).toContain("check = true");
      }, {
        listFiles: async () => result,
        copyFile: async (source, destination) => cp(join(fixtures, source), destination),
      });
      await expect(readFile(join(snapshot!, "src/app.ts"), "utf8")).rejects.toThrow();
      let unsafeSnapshot: string | undefined;
      await expect(withSourceSnapshot(async () => {}, {
        listFiles: async () => ["../outside"],
        makeTempDirectory: async () => { unsafeSnapshot = await mkdtemp(join(tmpdir(), "mct-unsafe-snapshot-")); return unsafeSnapshot; },
      })).rejects.toThrow(/unsafe path/);
      await expect(readFile(unsafeSnapshot!, "utf8")).rejects.toThrow();
    } finally {
      await rm(fixtures, { recursive: true, force: true });
    }
  });

  it("fails closed when an eligible source finding is reported", async () => {
    const dependencies = {
      runScanner: () => {},
      readSarif: async () => JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "gitleaks" } }, results: [{ ruleId: "fixture-secret" }] }] }),
      makeReportDirectory: async () => {},
    };
    await expect(scanSecrets(["eligible-source-fixture"], dependencies)).rejects.toThrow(/finding/);
  });

  it("builds both deployment artifacts before a finding stops the preflight", async () => {
    const order: string[] = [];
    await expect(runDeploymentPreflight("preview", async () => { order.push("worker"); }, async () => { order.push("frontend"); }, async () => {
      order.push("scan");
      throw new Error("secret finding");
    })).rejects.toThrow(/secret finding/);
    expect(order).toEqual(["worker", "frontend", "scan"]);
    let buildWasRun = false;
    await expect(runDeploymentPreflight("staging", async () => { buildWasRun = true; }, async () => {}, async () => {})).rejects.toThrow(/preview or production/);
    expect(buildWasRun).toBe(false);
    const commands: string[] = [];
    await preflight("production", { runCommand: async (_command, args) => { commands.push(args.join(" ")); }, scanArtifacts: async () => { commands.push("scan"); } });
    expect(commands).toEqual([
      "run build:production --workspace @municipal-tracker/backend",
      "run build --workspace @municipal-tracker/frontend",
      "scan",
    ]);
    expect(() => run("npm", [], {}, () => ({ status: 0 }))).not.toThrow();
    expect(() => run("npm", [], {}, () => ({ status: 2 }))).toThrow(/exit 2/);
    const script = fileURLToPath(new URL("./deployment-preflight.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, DEPLOY_ENVIRONMENT: "invalid" } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Deployment preflight blocked");
    const artifactScans: string[][] = [];
    await preflight("preview", { runCommand: async () => {}, scanArtifactSecrets: async (paths) => { artifactScans.push(paths); } });
    expect(artifactScans).toEqual([["app/backend/dist/preview", "app/frontend/dist"]]);
  });
});
