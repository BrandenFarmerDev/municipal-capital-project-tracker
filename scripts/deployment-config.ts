export interface DeploymentEnvironment {
  name: string;
  vars: { ALLOWED_ORIGIN: string; ACCESS_AUD: string; ACCESS_TEAM_DOMAIN: string; OWNER_EMAIL: string };
  routes: { pattern: string; custom_domain: boolean }[];
  d1_databases: { binding: string; database_name: string; database_id: string }[];
}

export interface DeploymentConfig {
  name: string;
  d1_databases: DeploymentEnvironment["d1_databases"];
  env: Record<string, DeploymentEnvironment>;
}

const PAGES_PROJECT = "municipal-capital-project-tracker";
// Resources owned by sibling applications must never be reused here.
const FORBIDDEN_RESOURCE_FRAGMENTS = ["job-search", "job_search", "portfolio"];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ACCESS_AUD = /^[a-f0-9]{64}$/i;

function resourceNames(config: DeploymentConfig): string[] {
  const environments = Object.values(config.env);
  return [
    config.name,
    ...config.d1_databases.flatMap((database) => [database.binding, database.database_name]),
    ...environments.flatMap((environment) => [environment.name, ...environment.d1_databases.flatMap((database) => [database.binding, database.database_name])]),
  ];
}

/** Static checks that hold for every environment, including the committed placeholders. */
export function validateResourceIsolation(config: DeploymentConfig): void {
  for (const name of resourceNames(config)) {
    if (FORBIDDEN_RESOURCE_FRAGMENTS.some((fragment) => name.toLowerCase().includes(fragment))) {
      throw new Error(`Resource name "${name}" is shared with or derived from a sibling application.`);
    }
  }
  const ids = [...config.d1_databases, ...Object.values(config.env).flatMap((environment) => environment.d1_databases)].map((database) => database.database_id);
  if (new Set(ids).size !== ids.length) throw new Error("Every environment must use a different D1 database ID.");
  const databaseNames = [...config.d1_databases, ...Object.values(config.env).flatMap((environment) => environment.d1_databases)].map((database) => database.database_name);
  if (new Set(databaseNames).size !== databaseNames.length) throw new Error("Every environment must use a different D1 database name.");
}

export function validateDeployment(config: DeploymentConfig, environment: string, variables: Record<string, string | undefined>) {
  if (!["preview", "production"].includes(environment)) throw new Error("Invalid deployment environment.");
  validateResourceIsolation(config);
  const settings = config.env[environment]!;
  const databaseId = settings.d1_databases[0]!.database_id;
  if (!UUID.test(databaseId) || databaseId.startsWith("00000000-")) throw new Error("Set the environment's real D1 database ID.");
  if (!ACCESS_AUD.test(settings.vars.ACCESS_AUD)) throw new Error("Set the environment's real Cloudflare Access application audience.");
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(settings.vars.ACCESS_TEAM_DOMAIN)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.vars.OWNER_EMAIL)) {
    throw new Error("Set the environment's Access team domain and owner email.");
  }
  const site = new URL(settings.vars.ALLOWED_ORIGIN);
  if (!variables.VITE_API_BASE_URL) throw new Error("Missing VITE_API_BASE_URL.");
  const api = new URL(variables.VITE_API_BASE_URL);
  if (site.protocol !== "https:" || site.origin !== settings.vars.ALLOWED_ORIGIN
    || api.protocol !== "https:" || api.origin !== variables.VITE_API_BASE_URL) {
    throw new Error("Site and API configuration must contain exact HTTPS origins without paths.");
  }
  if (variables.SITE_ORIGIN !== site.origin) throw new Error("SITE_ORIGIN must match the Worker's allowed origin.");
  if (!settings.routes.some((route) => route.custom_domain && route.pattern === api.hostname)) {
    throw new Error("VITE_API_BASE_URL must match the Worker's custom domain.");
  }
  if (variables.CLOUDFLARE_PAGES_PROJECT !== PAGES_PROJECT) throw new Error("Use this application's dedicated Pages project.");
  for (const name of ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]) {
    if (!variables[name]?.trim()) throw new Error(`Missing deployment secret ${name}.`);
  }
}
