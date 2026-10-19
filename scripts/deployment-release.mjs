import { pathToFileURL } from "node:url";
import { preflight, run } from "./deployment-preflight.mjs";

const ENVIRONMENTS = ["preview", "production"];
const PAGES_PROJECT_PATTERN = /^[A-Za-z0-9-]+$/;

export function workerUploadArguments(environment) {
  if (!ENVIRONMENTS.includes(environment)) throw new Error("Deployment environment must be preview or production.");
  return ["wrangler", "deploy", `dist/${environment}/index.js`, "--config", "wrangler.jsonc", "--env", environment, "--no-bundle"];
}

export async function releaseDeployment(environment, {
  runPreflight = preflight,
  runCommand = run,
  pagesProject = process.env.CLOUDFLARE_PAGES_PROJECT,
} = {}) {
  if (!ENVIRONMENTS.includes(environment)) throw new Error("Deployment environment must be preview or production.");
  if (typeof pagesProject !== "string" || !PAGES_PROJECT_PATTERN.test(pagesProject)) {
    throw new Error("CLOUDFLARE_PAGES_PROJECT is missing or invalid.");
  }

  await runCommand("node", ["scripts/install-quality-tools.mjs", "--secrets-only"]);
  await runPreflight(environment);
  await runCommand("npx", ["wrangler", "d1", "migrations", "apply", "MCT_DB", "--remote", "--env", environment], { cwd: "app/backend" });
  await runCommand("npx", workerUploadArguments(environment), { cwd: "app/backend" });
  await runCommand("npx", ["wrangler", "pages", "deploy", "app/frontend/dist", "--force", "--project-name", pagesProject, "--branch", environment === "production" ? "main" : "preview"]);
  await runCommand("node", ["scripts/check-private-deployment.mjs"]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await releaseDeployment(process.env.DEPLOY_ENVIRONMENT);
  } catch (error) {
    console.error(`Deployment release blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
