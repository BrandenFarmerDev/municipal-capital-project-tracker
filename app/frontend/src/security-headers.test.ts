import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(resolve(process.cwd(), "public", name), "utf8");
const headers = read("_headers");

describe("Cloudflare Pages security headers", () => {
  it("locks the owner interface to its required browser capabilities", () => {
    expect(headers).toContain("default-src 'none'");
    expect(headers).toContain("script-src 'self'");
    expect(headers).toContain("style-src 'self'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("Referrer-Policy: no-referrer");
    expect(headers).toContain("Permissions-Policy:");
    expect(headers).toContain("Cross-Origin-Opener-Policy: same-origin");
    expect(headers).toContain("Strict-Transport-Security: max-age=31536000; includeSubDomains");
  });
  it("allows only this application's API origins and never unsafe script sources", () => {
    const csp = headers.split("\n").find((line) => line.includes("Content-Security-Policy"))!;
    expect(csp).toContain("connect-src 'self' https://capital-api-test.brandenfarmer.com https://capital-api.brandenfarmer.com");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });
  it("keeps the private site out of search indexes and serves the SPA fallback", () => {
    expect(headers).toContain("X-Robots-Tag: noindex, nofollow");
    expect(read("robots.txt")).toContain("Disallow: /");
    expect(read("_redirects").trim()).toBe("/* /index.html 200");
  });
  it("caches only fingerprinted assets", () => {
    expect(headers).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  });
});
