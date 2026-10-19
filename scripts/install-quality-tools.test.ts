import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodeQLParserModuleScope, extractArchive, verifyArchiveDigest } from "./install-quality-tools.mjs";

let temporaryDirectory: string | undefined;

afterEach(() => {
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

describe("pinned scanner setup safeguards", () => {
  it("accepts the expected archive digest and rejects tampering", () => {
    expect(() => verifyArchiveDigest("abc123", "abc123", "fixture tool")).not.toThrow();
    expect(() => verifyArchiveDigest("different", "abc123", "fixture tool")).toThrow(/SHA-256 mismatch/);
  });

  it("writes and verifies the CodeQL parser CommonJS package boundary", () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "mct-codeql-parser-test-"));
    const packageFile = ensureCodeQLParserModuleScope(temporaryDirectory);
    expect(JSON.parse(readFileSync(packageFile, "utf8"))).toEqual({ type: "commonjs" });
  });

  it("uses unzip for Linux ZIP releases and keeps tar formats on their supported extractors", () => {
    const root = mkdtempSync(join(tmpdir(), "mct-archive-extract-test-"));
    temporaryDirectory = root;
    const calls: Array<{ command: string; args: string[] }> = [];
    const spawn = (command: string, args: string[]) => {
      calls.push({ command, args });
      return { status: 0 };
    };

    extractArchive("codeql-linux64.zip", join(root, "codeql"), "linux", spawn);
    extractArchive("gitleaks_8.30.1_linux_x64.tar.gz", join(root, "gitleaks"), "linux", spawn);
    extractArchive("codeql-win64.zip", join(root, "codeql-windows"), "windows", spawn);

    expect(calls).toEqual([
      { command: "unzip", args: ["-q", "codeql-linux64.zip", "-d", join(root, "codeql")] },
      { command: "tar", args: ["-xf", "gitleaks_8.30.1_linux_x64.tar.gz", "-C", join(root, "gitleaks")] },
      { command: "tar", args: ["-xf", "codeql-win64.zip", "-C", join(root, "codeql-windows")] },
    ]);
  });

  it("fails when the platform archive extractor reports an error", () => {
    const root = mkdtempSync(join(tmpdir(), "mct-archive-failure-test-"));
    temporaryDirectory = root;
    expect(() => extractArchive("codeql-linux64.zip", join(root, "codeql"), "linux", () => ({ status: 2 })))
      .toThrow(/Could not extract codeql-linux64.zip/);
    expect(() => extractArchive("codeql-linux64.zip", join(root, "codeql"), "linux", () => ({ error: new Error("unzip missing"), status: null })))
      .toThrow(/unzip missing/);
  });
});
