import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { git, run, runPrePush, runValidatedQuality, validatePublication } from "./pre-push.mjs";

const head = "a".repeat(40);
const remote = "b".repeat(40);
const record = (localRef = "refs/heads/bfarmer/test", localSha = head, remoteRef = "refs/heads/test", remoteSha = remote) =>
  `${localRef} ${localSha} ${remoteRef} ${remoteSha}`;

describe("pre-push publication boundary", () => {
  it("accepts only a current bfarmer HEAD publication", () => {
    expect(validatePublication([record()], "bfarmer/test", head)).toEqual({
      deletion: false, localRef: "refs/heads/bfarmer/test", remoteRef: "refs/heads/test",
    });
  });

  it("rejects malformed, multi-ref, stale, non-branch, and protected publications", () => {
    for (const [lines, branch, tip] of [
      [[], "bfarmer/test", head],
      [[record(), record("refs/heads/bfarmer/other")], "bfarmer/test", head],
      [["malformed"], "bfarmer/test", head],
      [[record("refs/heads/bfarmer/test", remote)], "bfarmer/test", head],
      [[record("refs/heads/main")], "main", head],
      [[record("refs/heads/bfarmer/test", head, "refs/tags/v1")], "bfarmer/test", head],
    ] as const) expect(() => validatePublication(Array.from(lines), branch, tip)).toThrow();
  });

  it("allows deleting a non-protected remote branch without running quality", () => {
    expect(validatePublication([record("refs/heads/bfarmer/test", "0".repeat(40))], "bfarmer/test", head)).toEqual({ deletion: true, remoteRef: "refs/heads/test" });
    expect(() => validatePublication([record("refs/heads/bfarmer/test", "0".repeat(40), "refs/heads/main")], "bfarmer/test", head)).toThrow();
  });

  it("requires a clean tested HEAD and rechecks the exact tip after quality", () => {
    const options = {
      initialHead: head, publicationHead: head, quality() {}, currentHead: () => head,
      currentPublicationHead: () => head, workingTreeClean: () => true,
    };
    expect(() => runValidatedQuality(options)).not.toThrow();
    expect(() => runValidatedQuality({ ...options, workingTreeClean: () => false })).toThrow(/clean/);
    expect(() => runValidatedQuality({ ...options, publicationHead: remote })).toThrow(/does not point to HEAD/);
    expect(() => runValidatedQuality({ ...options, quality() { throw new Error("quality failed"); } })).toThrow(/quality failed/);
    expect(() => runValidatedQuality({ ...options, currentHead: () => remote })).toThrow(/changed while checks/);
    expect(() => runValidatedQuality({ ...options, currentPublicationHead: () => remote })).toThrow(/changed while checks/);
  });

  it("runs quality once for the clean publication tip and fails closed on malformed hook input", () => {
    const calls: string[] = [];
    let qualityRuns = 0;
    const gitCommand = (args: string[]) => {
      calls.push(args.join(" "));
      if (args[0] === "branch") return "bfarmer/test";
      if (args[0] === "status") return "";
      return head;
    };
    runPrePush(record(), { gitCommand, runQuality: () => { qualityRuns += 1; } });
    expect(qualityRuns).toBe(1);
    expect(calls).toContain("rev-parse refs/heads/bfarmer/test");

    const script = fileURLToPath(new URL("./pre-push.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script], { input: "malformed\n", encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Pre-push blocked");
    const outsideRepository = spawnSync(process.execPath, [script], { cwd: "C:/", input: "malformed\n", encoding: "utf8" });
    expect(outsideRepository.status).toBe(1);
    expect(outsideRepository.stderr).toContain("Pre-push blocked");
    expect(() => runPrePush("malformed")).toThrow(/Malformed/);
    expect(git(["status", "--porcelain"], () => ({ status: 0, stdout: "", stderr: "" }))).toBe("");
    expect(() => git(["status"], () => ({ status: 1, stdout: "", stderr: "error" }))).toThrow("error");
    expect(() => git(["status"], () => ({ error: new Error("missing git") }))).toThrow("missing git");
    expect(() => run("npm", ["run", "quality"], () => ({ status: 0 }))).not.toThrow();
    expect(() => run("npm", ["run", "quality"], () => ({ status: 1 }))).toThrow(/exit 1/);
    expect(() => run("npm", [], () => ({ error: new Error("missing npm") }))).toThrow("missing npm");
    let invocation: { command: string; args: string[] } | undefined;
    run("npm", ["run", "quality"], (command, args) => { invocation = { command, args }; return { status: 0 }; });
    if (process.platform === "win32") {
      expect(invocation?.command).toBe(process.execPath);
      expect(invocation?.args).toEqual([join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), "run", "quality"]);
    }
  });
});
