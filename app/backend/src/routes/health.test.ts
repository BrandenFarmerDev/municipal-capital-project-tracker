import { describe, expect, it } from "vitest";
import { isHealthResponse } from "@municipal-tracker/shared";
import { healthRoute } from "./health";

describe("healthRoute", () => {
  it("returns a valid health payload", async () => {
    expect(isHealthResponse(await healthRoute().json())).toBe(true);
  });
});
