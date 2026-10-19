import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function tool(name) {
  const extension = process.platform === "win32" ? ".exe" : "";
  const version = name === "gitleaks" ? "8.30.1" : "2.27.2";
  return `.tools/${name}-${version}/${name === "codeql" ? `codeql/codeql${extension}` : `${name}${extension}`}`;
}

export function validateSarif(report, expectedTool, requireSuccessfulExecution = false) {
  if (!report || report.version !== "2.1.0" || !Array.isArray(report.runs) || report.runs.length === 0) {
    throw new Error(`${expectedTool} returned malformed or empty SARIF.`);
  }
  const acceptedNames = expectedTool === "gitleaks" ? new Set(["gitleaks", "Gitleaks"]) : new Set([expectedTool]);
  const matchingRuns = report.runs.filter((run) => acceptedNames.has(run.tool?.driver?.name));
  if (matchingRuns.length !== report.runs.length) throw new Error(`${expectedTool} SARIF contains unexpected tool runs.`);
  for (const run of matchingRuns) {
    if (!Array.isArray(run.results)) throw new Error(`${expectedTool} SARIF omitted results.`);
    if (requireSuccessfulExecution && !run.invocations?.some((invocation) => invocation.executionSuccessful === true)) {
      throw new Error(`${expectedTool} SARIF does not prove successful analysis execution.`);
    }
    if (run.results.length) throw new Error(`${expectedTool} reported ${run.results.length} finding(s).`);
  }
}

export function assertScannerSucceeded(result, command) {
  if (result.error) throw new Error(`Required scanner ${command} is unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr?.trim() || "no diagnostic output"}`);
}

function run(command, args) {
  const timeout = command.includes("gitleaks") ? 60_000 : 180_000;
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout });
  assertScannerSucceeded(result, command);
}

async function readReport(path, readSarif) {
  const rawReport = await readSarif(path);
  return typeof rawReport === "string" ? JSON.parse(rawReport) : rawReport;
}

async function scanWithGitleaks(paths, { runScanner = run, readSarif = (path) => readFile(path, "utf8"), makeReportDirectory = () => mkdir("reports/security", { recursive: true }) } = {}) {
  await makeReportDirectory();
  for (const [index, path] of paths.entries()) {
    const reportPath = `reports/security/gitleaks-${index}.sarif`;
    runScanner(tool("gitleaks"), ["dir", "--config", ".gitleaks.toml", path, "--no-banner", "--redact", "--report-format", "sarif", "--report-path", reportPath, "--exit-code", "0"]);
    validateSarif(await readReport(reportPath, readSarif), "gitleaks");
  }
}

async function scanWithCodeQL({ runScanner = run, readSarif = (path) => readFile(path, "utf8"), makeReportDirectory = () => mkdir("reports/security", { recursive: true }), sourceRoot = "." } = {}) {
  const database = "reports/security/codeql-db";
  const reportPath = "reports/security/codeql.sarif";
  await makeReportDirectory();
  runScanner(tool("codeql"), ["database", "create", database, "--language=javascript-typescript", "--build-mode=none", `--source-root=${sourceRoot}`, "--overwrite"]);
  runScanner(tool("codeql"), ["database", "analyze", database, "codeql/javascript-queries@2.4.7:codeql-suites/javascript-security-extended.qls", "--format=sarifv2.1.0", `--output=${reportPath}`]);
  validateSarif(await readReport(reportPath, readSarif), "CodeQL", true);
}

export async function scanSecrets(paths, dependencies = {}) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.some((path) => typeof path !== "string" || !path)) {
    throw new Error("Security scan paths must be a non-empty list of paths.");
  }
  await scanWithGitleaks(paths, dependencies);
}

export async function scan(paths, dependencies = {}) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.some((path) => typeof path !== "string" || !path)) {
    throw new Error("Security scan paths must be a non-empty list of paths.");
  }
  await scanSecrets(paths, dependencies);
  await scanWithCodeQL(dependencies);
}

export async function sourceFiles(runGit = (args) => spawnSync("git", args, { encoding: "utf8" })) {
  const result = runGit(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
  assertScannerSucceeded(result, "git ls-files");
  return [...new Set(result.stdout.split("\0").filter(Boolean))];
}

export async function withSourceSnapshot(action, { listFiles = sourceFiles, copyFile = cp, makeTempDirectory = () => mkdtemp(join(tmpdir(), "mct-security-")), removeDirectory = rm } = {}) {
  const root = await makeTempDirectory();
  const started = Date.now();
  try {
    const files = await listFiles();
    console.log(`Source scan snapshot: ${files.length} eligible files.`);
    for (const file of files) {
      if (isAbsolute(file) || file.split(/[\\/]/).some((part) => part === ".." || part === ".")) throw new Error("Source scan file list contains an unsafe path.");
      const target = resolve(root, file);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(file, target);
    }
    return await action(root);
  } finally {
    console.log(`Source scan snapshot completed in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
    await removeDirectory(root, { recursive: true, force: true });
  }
}

export function deploymentArtifactPaths(environment) {
  if (!['preview', 'production'].includes(environment)) throw new Error("DEPLOY_ENVIRONMENT must be preview or production for the artifact scan.");
  return [`app/backend/dist/${environment}`, "app/frontend/dist"];
}

export function localBuildArtifactPaths() {
  return ["app/backend/dist", "app/frontend/dist"];
}

export async function runScanCli(args, environment, dependencies = {}) {
  const secretOnly = args[0] === "--secrets-only";
  let paths = args.slice(secretOnly ? 1 : 0);
  const localBuildArtifacts = args[0] === "--local-build-artifacts";
  if (localBuildArtifacts) paths = localBuildArtifactPaths();
  if (!paths.length && secretOnly) paths = deploymentArtifactPaths(environment);
  if (!paths.length) {
    return withSourceSnapshot(async (root) => {
      await scanSecrets([root], dependencies);
      await scanWithCodeQL({ ...dependencies, sourceRoot: root });
    }, dependencies);
  }
  if (secretOnly || localBuildArtifacts) await scanSecrets(paths, dependencies);
  else await scan(paths, dependencies);
}

/* c8 ignore start -- subprocess entry point is exercised separately from the in-process helper coverage. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runScanCli(process.argv.slice(2), process.env.DEPLOY_ENVIRONMENT);
  } catch (error) {
    console.error(`Security scan blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
/* c8 ignore stop */
