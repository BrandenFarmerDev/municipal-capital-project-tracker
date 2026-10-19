import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const versions = {
  gitleaks: {
    version: "8.30.1",
    windows: { url: "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_windows_x64.zip", sha256: "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e" },
    linux: { url: "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz", sha256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb" },
  },
  actionlint: {
    version: "1.7.12",
    windows: { url: "https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_windows_amd64.zip", sha256: "6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9" },
    linux: { url: "https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz", sha256: "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8" },
  },
  codeql: {
    version: "2.27.2",
    windows: { url: "https://github.com/github/codeql-cli-binaries/releases/download/v2.27.2/codeql-win64.zip", sha256: "6c90c8503af7b13827a151fbada959c1e5e4a49dd4ebad5bf0855f8a54404c1b" },
    linux: { url: "https://github.com/github/codeql-cli-binaries/releases/download/v2.27.2/codeql-linux64.zip", sha256: "ac0a4ea06843577ed3a1f5af145756c3085ebfd42e59a5aff1b66489f29d16dc" },
  },
};

const root = ".tools";
const platform = process.platform === "win32" ? "windows" : process.platform === "linux" ? "linux" : null;
if (!platform) throw new Error(`Unsupported scanner platform: ${process.platform}`);
const binaries = {
  gitleaks: `${root}/gitleaks-${versions.gitleaks.version}/gitleaks${platform === "windows" ? ".exe" : ""}`,
  actionlint: `${root}/actionlint-${versions.actionlint.version}/actionlint${platform === "windows" ? ".exe" : ""}`,
  codeql: `${root}/codeql-${versions.codeql.version}/codeql/codeql${platform === "windows" ? ".exe" : ""}`,
};
const versionArguments = (name) => name === "actionlint" ? ["-version"] : ["version"];

export function verifyArchiveDigest(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name} SHA-256 mismatch.`);
}

export function ensureCodeQLParserModuleScope(parserDirectory) {
  // Node otherwise inherits this repository's top-level type=module into CodeQL's bundled CommonJS parser.
  mkdirSync(parserDirectory, { recursive: true });
  const packageFile = `${parserDirectory}/package.json`;
  writeFileSync(packageFile, JSON.stringify({ type: "commonjs" }) + "\n");
  if (JSON.parse(readFileSync(packageFile, "utf8")).type !== "commonjs") throw new Error("CodeQL parser module scope is not isolated as CommonJS.");
  return packageFile;
}

async function downloadAndVerify(name, version, artifact) {
  const archive = `${root}/${name}-${version}.${platform === "windows" && name !== "codeql" ? "zip" : name === "codeql" ? "zip" : "tar.gz"}`;
  if (!existsSync(archive)) {
    const response = await fetch(artifact.url, { redirect: "follow" });
    if (!response.ok || !response.body) throw new Error(`Could not download official ${name} ${version} release (${response.status}).`);
    const hash = createHash("sha256");
    const tapHash = new Transform({ transform(chunk, encoding, callback) { hash.update(chunk); callback(null, chunk); } });
    await pipeline(response.body, tapHash, createWriteStream(archive));
    const actual = hash.digest("hex");
    try {
      verifyArchiveDigest(actual, artifact.sha256, `${name} ${version}`);
    } catch (error) {
      rmSync(archive, { force: true });
      throw error;
    }
  }
  const cachedHash = createHash("sha256");
  for await (const chunk of createReadStream(archive)) cachedHash.update(chunk);
  const actual = cachedHash.digest("hex");
  verifyArchiveDigest(actual, artifact.sha256, `${name} cached archive`);
  return archive;
}

function extract(name, archive, destination) {
  if (existsSync(binaries[name])) return;
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  const result = spawnSync("tar", ["-xf", archive, "-C", destination], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Could not extract ${archive}.`);
}

async function install(name) {
  const binary = binaries[name];
  const probe = spawnSync(binary, versionArguments(name), { encoding: "utf8" });
  if (!probe.error && probe.status === 0 && `${probe.stdout}${probe.stderr}`.includes(versions[name].version)) return;
  const archive = await downloadAndVerify(name, versions[name].version, versions[name][platform]);
  const destination = `${root}/${name}-${versions[name].version}`;
  extract(name, archive, destination);
  if (!existsSync(binary)) throw new Error(`${name} ${versions[name].version} extraction did not produce the expected executable.`);
  const verified = spawnSync(binary, versionArguments(name), { encoding: "utf8" });
  if (verified.error || verified.status !== 0 || !`${verified.stdout}${verified.stderr}`.includes(versions[name].version)) {
    throw new Error(`${name} extracted executable did not report the pinned version.`);
  }
}

function isolateCodeQLParserModuleScope() {
  const parserDirectory = `${root}/codeql-${versions.codeql.version}/codeql/javascript/tools/typescript-parser-wrapper`;
  ensureCodeQLParserModuleScope(parserDirectory);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(root, { recursive: true });
  const secretsOnly = process.argv.includes("--secrets-only");
  const names = secretsOnly ? ["gitleaks"] : ["gitleaks", "actionlint", "codeql"];
  for (const name of names) await install(name);
  if (!secretsOnly) {
    isolateCodeQLParserModuleScope();
    const result = spawnSync(binaries.codeql, ["pack", "download", "codeql/javascript-queries@2.4.7"], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Could not provision the pinned CodeQL JavaScript query pack.");
  }
  console.log(`Verified quality tools: ${names.map((name) => `${name} ${versions[name].version}`).join(", ")}`);
}
