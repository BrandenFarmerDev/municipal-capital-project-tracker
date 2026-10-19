import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const ZERO_SHA = /^0+$/;

export function validatePublication(lines, currentBranch, headSha) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("No publication refs were provided.");
  if (lines.length !== 1) throw new Error("Publish one branch at a time so the tested tip is unambiguous.");
  const fields = lines[0].trim().split(/\s+/);
  if (fields.length !== 4) throw new Error("Malformed pre-push ref record.");
  const [localRef, localSha, remoteRef, remoteSha] = fields;
  if (!/^refs\/heads\/[A-Za-z0-9._/-]+$/.test(remoteRef)) throw new Error("Only branch refs can be published.");
  if (remoteRef === "refs/heads/main") throw new Error("Direct publication to main is blocked.");
  if (ZERO_SHA.test(localSha)) return { deletion: true, remoteRef };
  if (!/^refs\/heads\/bfarmer\/[A-Za-z0-9._/-]+$/.test(localRef)) throw new Error("Publish only the current bfarmer branch.");
  if (localSha !== headSha) throw new Error("Publication must target the tested HEAD.");
  if (currentBranch !== localRef.slice("refs/heads/".length)) throw new Error("Publication ref must match the checked-out branch.");
  if (!/^[0-9a-f]{40,64}$/i.test(remoteSha)) throw new Error("Malformed remote object id.");
  return { deletion: false, localRef, remoteRef };
}

export function git(args, spawn = spawnSync) {
  const result = spawn("git", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args[0]} failed.`);
  return result.stdout.trim();
}

export function run(command, args, spawn = spawnSync) {
  const invocation = process.platform === "win32" && command === "npm"
    ? { command: process.execPath, args: [join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), ...args] }
    : { command, args };
  const result = spawn(invocation.command, invocation.args, { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}.`);
}

export function runValidatedQuality({ initialHead, publicationHead, quality, currentHead, currentPublicationHead, workingTreeClean }) {
  if (!workingTreeClean()) throw new Error("The working tree must be clean before and after the quality gate.");
  if (initialHead !== publicationHead) throw new Error("Publication ref does not point to HEAD.");
  quality();
  if (!workingTreeClean() || currentHead() !== initialHead || currentPublicationHead() !== initialHead) {
    throw new Error("HEAD or the publication ref changed while checks were running.");
  }
}

export function runPrePush(stdin, dependencies = {}) {
  const gitCommand = dependencies.gitCommand ?? git;
  const runQuality = dependencies.runQuality ?? (() => run("npm", ["run", "quality"]));
  const cleanWorkingTree = dependencies.cleanWorkingTree ?? (() => !gitCommand(["status", "--porcelain"]));
  const branch = gitCommand(["branch", "--show-current"]);
  const records = stdin.split(/\r?\n/).filter((line) => line.trim());
  const publication = validatePublication(records, branch, gitCommand(["rev-parse", "HEAD"]));
  if (publication.deletion) return;
  const testedHead = gitCommand(["rev-parse", "HEAD"]);
  runValidatedQuality({
    initialHead: testedHead,
    publicationHead: gitCommand(["rev-parse", publication.localRef]),
    quality: runQuality,
    currentHead: () => gitCommand(["rev-parse", "HEAD"]),
    currentPublicationHead: () => gitCommand(["rev-parse", publication.localRef]),
    workingTreeClean: cleanWorkingTree,
  });
  console.log(`Validated ${testedHead} for ${publication.remoteRef}.`);
}

/* c8 ignore start -- subprocess hook behavior is exercised separately; imported unit coverage tests the delegated functions. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let stdin = "";
  for await (const chunk of process.stdin) stdin += chunk;
  try { runPrePush(stdin); } catch (error) {
    console.error(`Pre-push blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
/* c8 ignore stop */
