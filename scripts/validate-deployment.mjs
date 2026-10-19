import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { validateDeployment } from "./deployment-config.ts";

export function validateDeploymentFile(configPath, environment, variables = process.env, readFile = readFileSync) {
  // wrangler.jsonc intentionally uses JSON syntax so the guard needs no parser dependency.
  const config = JSON.parse(readFile(configPath, "utf8"));
  validateDeployment(config, environment, variables);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateDeploymentFile("app/backend/wrangler.jsonc", process.argv[2]);
    console.log("Deployment configuration is ready.");
  } catch (error) {
    console.error(`Deployment configuration blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
