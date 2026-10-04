import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { apiJson, renderApp, stubApi } from "../test/render";
import { violations } from "../test/axe";

describe("HomePage", () => {
  it("reports a connected API", async () => {
    stubApi();
    const { container } = renderApp("/");
    expect(await screen.findByText("API connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View projects" })).toHaveAttribute("href", "/projects");
    expect(await violations(container)).toEqual([]);
  });
  it("reports an unavailable API", async () => {
    stubApi(() => apiJson({}, 500));
    renderApp("/");
    expect(await screen.findByText(/API unavailable/)).toBeInTheDocument();
  });
  it("shows the checking state first", () => {
    stubApi(() => new Promise<Response>(() => undefined));
    renderApp("/");
    expect(screen.getByText(/Checking API connection/)).toBeInTheDocument();
  });
});
