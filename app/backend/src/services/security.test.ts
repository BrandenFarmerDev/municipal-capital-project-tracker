import { afterEach, describe, expect, it, vi } from "vitest";
import { authorize } from "./security";
import { fixture, ownerToken, stubJwks } from "../test/fixtures";

afterEach(() => vi.unstubAllGlobals());
const request = (token?: string) => new Request("https://api.example.com/api/projects", { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} });

describe("authorize", () => {
  it("accepts a signed token for the owner and returns its subject", async () => {
    const { env, close } = fixture();
    stubJwks();
    expect(await authorize(request(await ownerToken(env)), env)).toBe("owner-subject");
    close();
  });
  it.each([
    ["another user", { email: "attacker@example.com" }],
    ["the wrong audience", { audience: "other" }],
    ["the wrong issuer", { issuer: "https://other.cloudflareaccess.com" }],
    ["an expired token", { expiresIn: 1 }],
  ])("rejects %s", async (_name, overrides) => {
    const { env, close } = fixture();
    stubJwks();
    await expect(authorize(request(await ownerToken(env, overrides)), env)).rejects.toMatchObject({ status: 401, code: "authentication_required" });
    close();
  });
  it("rejects malformed and missing tokens", async () => {
    const { env, close } = fixture();
    stubJwks();
    await expect(authorize(request("not-a-jwt"), env)).rejects.toMatchObject({ status: 401 });
    await expect(authorize(request(), env)).rejects.toMatchObject({ status: 401 });
    close();
  });
  it.each([
    ["the local placeholder audience", { ACCESS_AUD: "unconfigured" }],
    ["a deployment placeholder audience", { ACCESS_AUD: "REPLACE_WITH_PREVIEW_ACCESS_AUD" }],
    ["an empty audience", { ACCESS_AUD: "" }],
    ["an empty owner", { OWNER_EMAIL: "" }],
    ["a non-Access team domain", { ACCESS_TEAM_DOMAIN: "evil.example" }],
  ])("fails closed with 503 for %s", async (_name, change) => {
    const { env, close } = fixture();
    await expect(authorize(request("token"), { ...env, ...change })).rejects.toMatchObject({ status: 503, code: "auth_unconfigured" });
    close();
  });
});
