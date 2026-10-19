import { describe, expect, it } from "vitest";
import { verifyPrivateDeployment } from "./check-private-deployment.mjs";

const config = JSON.stringify({ env: { preview: { vars: { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "audience-id" } } } });
const challenge = () => new Response(null, { status: 302, headers: { location: "https://team.cloudflareaccess.com/cdn-cgi/access/login/app?kid=audience-id" } });

describe("private deployment release check", () => {
  it("checks both the site and API for the expected Access challenge", async () => {
    const requests: string[] = [];
    await verifyPrivateDeployment("wrangler.jsonc", "preview", "https://site.example", "https://api.example", async (url) => { requests.push(String(url)); return challenge(); }, () => config);
    expect(requests).toEqual(["https://site.example", "https://api.example/api/projects"]);
  });
  it("stops when either endpoint lacks the configured challenge or the environment is absent", async () => {
    let count = 0;
    await expect(verifyPrivateDeployment("wrangler.jsonc", "preview", "https://site.example", "https://api.example", async () => ++count === 1 ? challenge() : new Response("public", { status: 200 }), () => config)).rejects.toThrow(/Access login challenge/);
    await expect(verifyPrivateDeployment("wrangler.jsonc", "production", "https://site.example", "https://api.example", fetch, () => config)).rejects.toThrow(/no configured Access audience/);
  });
});
