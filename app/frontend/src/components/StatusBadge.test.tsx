import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("shows the status as text", () => {
    render(<StatusBadge status="at_risk" />);
    expect(screen.getByText("At risk")).toHaveAttribute("data-status", "at_risk");
  });
});
