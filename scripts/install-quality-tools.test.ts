import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodeQLParserModuleScope, verifyArchiveDigest } from "./install-quality-tools.mjs";

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
});
