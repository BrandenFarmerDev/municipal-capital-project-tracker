import { createRemoteJWKSet, jwtVerify } from "jose";

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export class Problem extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

// Placeholder values are treated as missing so unconfigured environments fail closed.
const isUnconfigured = (value: string | undefined): boolean => !value || value === "unconfigured" || value.startsWith("REPLACE_WITH_");

/** Verifies the Cloudflare Access JWT and requires the single configured owner. Returns the token subject. */
export async function authorize(request: Request, env: Env): Promise<string> {
  if (isUnconfigured(env.ACCESS_AUD) || isUnconfigured(env.OWNER_EMAIL) || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)) {
    throw new Problem(503, "auth_unconfigured");
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new Problem(401, "authentication_required");
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), { timeoutDuration: 5000 });
    keySets.set(issuer, keys);
  }
  try {
    const { payload } = await jwtVerify(token, keys, { issuer, audience: env.ACCESS_AUD, algorithms: ["RS256"], requiredClaims: ["exp", "sub", "email"] });
    if (payload.email !== env.OWNER_EMAIL) throw new Error("owner_required");
    return payload.sub!;
  } catch {
    throw new Problem(401, "authentication_required");
  }
}
