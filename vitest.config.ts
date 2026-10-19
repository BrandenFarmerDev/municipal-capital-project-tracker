import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["scripts/deployment-config.ts", "scripts/pre-push.mjs", "scripts/security-scan.mjs", "scripts/deployment-preflight.mjs", "scripts/deployment-release.mjs", "scripts/audit.mjs", "scripts/validate-deployment.mjs", "scripts/check-private-deployment.mjs"],
      exclude: ["scripts/**/*.test.ts"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
});
