import { describe, expect, it } from "vitest";
import { validateDeploymentFile } from "./validate-deployment.mjs";

describe("deployment CLI validation helper", () => {
  it("fails closed on malformed configuration and an unsupported target", () => {
    expect(() => validateDeploymentFile("bad.jsonc", "preview", {}, () => "{" )).toThrow();
    const config = JSON.stringify({ name: "app", d1_databases: [], env: {} });
    expect(() => validateDeploymentFile("test.jsonc", "staging", {}, () => config)).toThrow(/Invalid deployment environment/);
  });
});
