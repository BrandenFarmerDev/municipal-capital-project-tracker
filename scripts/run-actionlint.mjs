import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function runActionlint() {
  const extension = process.platform === "win32" ? ".exe" : "";
  const binary = `.tools/actionlint-1.7.12/actionlint${extension}`;
  const workflows = readdirSync(".github/workflows").filter((name) => name.endsWith(".yml")).map((name) => `.github/workflows/${name}`);
  if (!workflows.length) throw new Error("No GitHub Actions workflow files were found.");
  const result = spawnSync(binary, workflows, { encoding: "utf8", stdio: "inherit" });
  if (result.error) throw new Error(`Required actionlint is unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`actionlint failed with exit ${result.status}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runActionlint(); } catch (error) {
    console.error(`Workflow validation blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
