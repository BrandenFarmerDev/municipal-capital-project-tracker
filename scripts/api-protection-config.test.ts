import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps every municipal environment isolated with the common 300/minute native policy", () => {
  const config = JSON.parse(readFileSync(new URL("../app/backend/wrangler.jsonc", import.meta.url), "utf8")) as {
    ratelimits: unknown; env: Record<string, { ratelimits: unknown; workers_dev: boolean; preview_urls: boolean }>;
    workers_dev: boolean; preview_urls: boolean;
  };
  for (const [environment, namespace] of [[config, "2004"], [config.env.preview!, "2005"], [config.env.production!, "2006"]] as const) {
    expect(environment.ratelimits).toEqual([{ name: "API_RATE_LIMITER", namespace_id: namespace, simple: { limit: 300, period: 60 } }]);
    expect(environment.workers_dev).toBe(false);
    expect(environment.preview_urls).toBe(false);
  }
});
