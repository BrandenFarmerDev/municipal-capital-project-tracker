import { describe, expect, it } from "vitest";
import { isHealthResponse, ROLES, SERVICE_NAME } from "./index";

const valid = { status: "ok", service: SERVICE_NAME, timestamp: "2026-10-01T00:00:00Z" };

describe("shared contracts", () => {
  it("defines the reserved roles", () => expect(ROLES).toEqual(["admin", "project_manager", "viewer"]));
  it("accepts a valid health response", () => expect(isHealthResponse(valid)).toBe(true));
  it.each([
    ["null", null], ["a string", "ok"], ["a wrong status", { ...valid, status: "down" }],
    ["a wrong service", { ...valid, service: "other" }], ["a missing timestamp", { status: "ok", service: SERVICE_NAME }],
    ["a bad timestamp", { ...valid, timestamp: "yesterday" }], ["a non-string timestamp", { ...valid, timestamp: 5 }],
    ["a missing service", { status: "ok", timestamp: valid.timestamp }], ["a missing status", { service: SERVICE_NAME, timestamp: valid.timestamp }],
  ])("rejects %s", (_name, value) => expect(isHealthResponse(value)).toBe(false));
});
