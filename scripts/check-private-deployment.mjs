import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function presentsExpectedAccessChallenge(response, settings) {
  const location = new URL(response.headers.get("location") || "https://invalid.example");
  return response.status === 302 && location.protocol === "https:"
    && location.hostname === settings.vars.ACCESS_TEAM_DOMAIN
    && location.pathname.startsWith("/cdn-cgi/access/login/")
    && location.searchParams.get("kid") === settings.vars.ACCESS_AUD;
}

export async function verifyPrivateDeployment(configPath, environment, siteOrigin, apiBaseUrl, request = fetch, readFile = readFileSync) {
  const config = JSON.parse(readFile(configPath, "utf8"));
  const settings = config.env?.[environment];
  if (!settings?.vars?.ACCESS_TEAM_DOMAIN || !settings.vars.ACCESS_AUD) throw new Error("Deployment environment has no configured Access audience.");
  for (const target of [siteOrigin, `${apiBaseUrl}/api/projects`]) {
    const response = await request(target, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    if (!presentsExpectedAccessChallenge(response, settings)) {
      throw new Error("Private deployment did not present its expected Access login challenge.");
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyPrivateDeployment("app/backend/wrangler.jsonc", process.env.DEPLOY_ENVIRONMENT, process.env.SITE_ORIGIN, process.env.VITE_API_BASE_URL);
    console.log("Site and API present the configured Access login challenge. Verify owner-only policy separately.");
  } catch (error) {
    console.error(`Private deployment check blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
