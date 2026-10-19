import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { scanSecrets } from "./security-scan.mjs";

export function run(command, args, options = {}, spawn = spawnSync) {
  const result = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit ${result.status}.`);
}

export async function runDeploymentPreflight(environment, buildWorker, buildFrontend, scanArtifacts) {
  if (!['preview', 'production'].includes(environment)) throw new Error("Deployment environment must be preview or production.");
  await buildWorker(environment);
  await buildFrontend();
  await scanArtifacts(environment);
}

export async function preflight(environment, { runCommand = run, scanArtifacts = null, scanArtifactSecrets = scanSecrets } = {}) {
  await runDeploymentPreflight(
    environment,
    (target) => runCommand("npm", ["run", `build:${target}`, "--workspace", "@municipal-tracker/backend"]),
    () => runCommand("npm", ["run", "build", "--workspace", "@municipal-tracker/frontend"]),
    async (target) => {
      if (scanArtifacts) return scanArtifacts(target);
      process.env.DEPLOY_ENVIRONMENT = target;
      await scanArtifactSecrets([`app/backend/dist/${target}`, "app/frontend/dist"]);
    },
  );
}

/* c8 ignore start -- subprocess entry point is exercised separately from the in-process helper coverage. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await preflight(process.env.DEPLOY_ENVIRONMENT);
  } catch (error) {
    console.error(`Deployment preflight blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
/* c8 ignore stop */
