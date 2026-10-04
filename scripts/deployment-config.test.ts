import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateDeployment, validateResourceIsolation, type DeploymentConfig } from "./deployment-config";

const database = (name: string, id: string) => ({ binding: "MCT_DB", database_name: name, database_id: id });
const AUD_A = "a".repeat(64);
const AUD_B = "b".repeat(64);

function configuration(): DeploymentConfig {
  return {
    name: "municipal-capital-project-tracker-api-local",
    d1_databases: [database("municipal-capital-project-tracker-local", "00000000-0000-0000-0000-000000000001")],
    env: {
      preview: { name: "municipal-capital-project-tracker-api-preview", vars: { ALLOWED_ORIGIN: "https://preview.example.com", ACCESS_AUD: AUD_A, ACCESS_TEAM_DOMAIN: "demo.cloudflareaccess.com", OWNER_EMAIL: "owner@example.com" }, routes: [{ pattern: "api.example.com", custom_domain: true }], d1_databases: [database("municipal-capital-project-tracker-preview", "11111111-1111-4111-8111-111111111111")] },
      production: { name: "municipal-capital-project-tracker-api", vars: { ALLOWED_ORIGIN: "https://example.com", ACCESS_AUD: AUD_B, ACCESS_TEAM_DOMAIN: "demo.cloudflareaccess.com", OWNER_EMAIL: "owner@example.com" }, routes: [{ pattern: "api.example.com", custom_domain: true }], d1_databases: [database("municipal-capital-project-tracker-production", "22222222-2222-4222-8222-222222222222")] },
    },
  };
}
const variables = { VITE_API_BASE_URL: "https://api.example.com", SITE_ORIGIN: "https://preview.example.com", CLOUDFLARE_PAGES_PROJECT: "municipal-capital-project-tracker", CLOUDFLARE_ACCOUNT_ID: "test-account", CLOUDFLARE_API_TOKEN: "test-token" };

describe("committed wrangler.jsonc", () => {
  const committed = JSON.parse(readFileSync(new URL("../app/backend/wrangler.jsonc", import.meta.url), "utf8")) as DeploymentConfig;
  it("does not share resources across environments or with sibling applications", () => {
    expect(() => validateResourceIsolation(committed)).not.toThrow();
  });
  it("uses provisioned remote database IDs", () => {
    for (const environment of ["preview", "production"]) {
      expect(committed.env[environment]!.d1_databases[0]!.database_id).not.toMatch(/^00000000-/);
    }
  });
});

describe("resource isolation", () => {
  it("accepts independent resources", () => expect(() => validateResourceIsolation(configuration())).not.toThrow());
  it.each(["job-search-intelligence-api", "Job_Search_DB", "branden-farmer-portfolio-api"])("rejects the sibling-derived name %s", (name) => {
    const config = configuration();
    config.env.preview!.name = name;
    expect(() => validateResourceIsolation(config)).toThrow("sibling");
  });
  it("rejects sibling-derived D1 names and bindings", () => {
    const config = configuration();
    config.d1_databases[0]!.database_name = "job-search-intelligence-local";
    expect(() => validateResourceIsolation(config)).toThrow("sibling");
    const bindingConfig = configuration();
    bindingConfig.env.production!.d1_databases[0]!.binding = "JOB_SEARCH_DB";
    expect(() => validateResourceIsolation(bindingConfig)).toThrow("sibling");
  });
  it("rejects placeholder database IDs reused across environments", () => {
    const config = configuration();
    config.env.preview!.d1_databases[0]!.database_id = config.d1_databases[0]!.database_id;
    expect(() => validateResourceIsolation(config)).toThrow("different D1 database ID");
  });
  it("rejects reused database names", () => {
    const config = configuration();
    config.env.preview!.d1_databases[0]!.database_name = config.env.production!.d1_databases[0]!.database_name;
    expect(() => validateResourceIsolation(config)).toThrow("different D1 database name");
  });
});

describe("deployment readiness guard", () => {
  it.each(["preview", "production"])("accepts independent configured %s resources", (environment) => {
    const config = configuration();
    expect(() => validateDeployment(config, environment, { ...variables, SITE_ORIGIN: config.env[environment]!.vars.ALLOWED_ORIGIN })).not.toThrow();
  });
  it("rejects invalid environments", () => expect(() => validateDeployment(configuration(), "other", variables)).toThrow("environment"));
  it.each([
    { ACCESS_TEAM_DOMAIN: "invalid.example" },
    { OWNER_EMAIL: "" },
  ])("rejects unusable owner auth configuration %j", (change) => {
    const config = configuration();
    Object.assign(config.env.preview!.vars, change);
    expect(() => validateDeployment(config, "preview", variables)).toThrow("team domain and owner email");
  });
  it("rejects an API origin not served by the configured Worker", () => {
    expect(() => validateDeployment(configuration(), "preview", { ...variables, VITE_API_BASE_URL: "https://wrong.example.com" })).toThrow("custom domain");
  });
  it.each(["REPLACE_WITH_PREVIEW_D1_ID", "00000000-0000-0000-0000-000000000002"])("rejects placeholder database %s", (id) => {
    const config = configuration();
    config.env.preview!.d1_databases[0]!.database_id = id;
    expect(() => validateDeployment(config, "preview", variables)).toThrow("real D1");
  });
  it.each(["unconfigured", "REPLACE_WITH_PREVIEW_ACCESS_AUD", ""])("rejects placeholder Access audience %j", (aud) => {
    const config = configuration();
    config.env.preview!.vars.ACCESS_AUD = aud;
    expect(() => validateDeployment(config, "preview", variables)).toThrow("Access application audience");
  });
  it.each(["http://example.com", "https://example.com/path", "https://example.com/"])("rejects site origin %s", (origin) => {
    const config = configuration();
    config.env.preview!.vars.ALLOWED_ORIGIN = origin;
    expect(() => validateDeployment(config, "preview", variables)).toThrow("HTTPS origins");
  });
  it.each(["http://api.example.com", "https://api.example.com/path", "https://api.example.com/"])("rejects API origin %s", (origin) => {
    expect(() => validateDeployment(configuration(), "preview", { ...variables, VITE_API_BASE_URL: origin })).toThrow("HTTPS origins");
  });
  it("rejects another application's Pages project", () => {
    expect(() => validateDeployment(configuration(), "preview", { ...variables, CLOUDFLARE_PAGES_PROJECT: "branden-farmer-portfolio" })).toThrow("dedicated Pages");
  });
  it("rejects a site origin that differs from Worker CORS", () => {
    expect(() => validateDeployment(configuration(), "preview", { ...variables, SITE_ORIGIN: "https://wrong.example.com" })).toThrow("must match");
  });
  it("requires an API origin", () => {
    expect(() => validateDeployment(configuration(), "preview", { ...variables, VITE_API_BASE_URL: undefined })).toThrow("Missing VITE_API_BASE_URL");
  });
  it.each(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"])("requires %s", (name) => {
    expect(() => validateDeployment(configuration(), "preview", { ...variables, [name]: "" })).toThrow(name);
  });
});
