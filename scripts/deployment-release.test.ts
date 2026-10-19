import { describe, expect, it } from "vitest";
import { releaseDeployment, workerUploadArguments } from "./deployment-release.mjs";

describe("artifact-based release commands", () => {
  it("selects the environment output with Wrangler bundling disabled and config retained", () => {
    expect(workerUploadArguments("preview")).toEqual([
      "wrangler", "deploy", "dist/preview/index.js", "--config", "wrangler.jsonc", "--env", "preview", "--no-bundle",
    ]);
    expect(workerUploadArguments("production")).toContain("dist/production/index.js");
    expect(() => workerUploadArguments("staging")).toThrow(/preview or production/);
  });

  it("runs preflight before migrations or uploads, and never continues after a scan failure", async () => {
    const effects: string[] = [];
    await expect(releaseDeployment("preview", {
      pagesProject: "municipal-capital-project-tracker",
      runCommand: async (_command, args) => { effects.push(args.join(" ")); },
      runPreflight: async () => { effects.push("preflight scan"); throw new Error("artifact finding"); },
    })).rejects.toThrow(/artifact finding/);
    expect(effects).toEqual(["scripts/install-quality-tools.mjs --secrets-only", "preflight scan"]);
    expect(effects.some((effect) => effect.includes("migrations apply") || effect.includes("pages deploy") || effect.includes("dist/preview/index.js"))).toBe(false);
  });

  it("publishes the scanned frontend and verifies protection only after the exact Worker bundle uploads", async () => {
    const effects: Array<{ command: string; args: string[]; options?: object }> = [];
    await releaseDeployment("preview", {
      pagesProject: "municipal-capital-project-tracker",
      runPreflight: async (environment) => { effects.push({ command: "preflight", args: [environment] }); },
      runCommand: async (command, args, options) => { effects.push({ command, args, options }); },
    });
    expect(effects.map(({ command }) => command)).toEqual(["node", "preflight", "npx", "npx", "npx", "node"]);
    expect(effects[3]).toEqual({
      command: "npx",
      args: ["wrangler", "deploy", "dist/preview/index.js", "--config", "wrangler.jsonc", "--env", "preview", "--no-bundle"],
      options: { cwd: "app/backend" },
    });
    expect(effects[4].args).toEqual(["wrangler", "pages", "deploy", "app/frontend/dist", "--force", "--project-name", "municipal-capital-project-tracker", "--branch", "preview"]);
  });
});
