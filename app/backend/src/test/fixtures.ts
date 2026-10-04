import { readFileSync } from "node:fs";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { vi } from "vitest";
import { createTestD1 } from "./sqlite-d1";

// One key pair per test file: the Worker caches the remote key set by issuer.
const keys = await generateKeyPair("RS256");
const jwk = { ...await exportJWK(keys.publicKey), kid: "owner" };

export const SEED_SQL = readFileSync(new URL("../../seed/local_high_desert_demo.sql", import.meta.url), "utf8");

export function fixture({ seed = true }: { seed?: boolean } = {}) {
  const database = createTestD1();
  if (seed) database.raw.exec(SEED_SQL);
  const env: Env = {
    MCT_DB: database.db,
    ALLOWED_ORIGIN: "https://capital-test.example.com",
    ACCESS_TEAM_DOMAIN: "test.cloudflareaccess.com",
    ACCESS_AUD: "owner-aud",
    OWNER_EMAIL: "owner@example.com",
  };
  return { env, db: database.db, raw: database.raw, close: database.close };
}

export function stubJwks() {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ keys: [jwk] })));
}

export async function ownerToken(env: Env, overrides: { email?: string; audience?: string; issuer?: string; expiresIn?: string | number } = {}) {
  return new SignJWT({ email: overrides.email ?? env.OWNER_EMAIL })
    .setSubject("owner-subject")
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? "1h")
    .setAudience(overrides.audience ?? env.ACCESS_AUD)
    .setIssuer(overrides.issuer ?? `https://${env.ACCESS_TEAM_DOMAIN}`)
    .setProtectedHeader({ alg: "RS256", kid: "owner" })
    .sign(keys.privateKey);
}

export async function authedRequest(env: Env, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cf-Access-Jwt-Assertion", await ownerToken(env));
  return new Request(url, { ...init, headers });
}
