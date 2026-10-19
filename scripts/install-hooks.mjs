import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const hooksDirectory = ".githooks";
if (!existsSync(`${hooksDirectory}/pre-push`)) throw new Error(`Missing tracked ${hooksDirectory}/pre-push hook.`);
const result = spawnSync("git", ["config", "--local", "core.hooksPath", hooksDirectory], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error("Could not install the repository pre-push hook.");
console.log(`Installed ${hooksDirectory} as this checkout's active Git hooks directory.`);
