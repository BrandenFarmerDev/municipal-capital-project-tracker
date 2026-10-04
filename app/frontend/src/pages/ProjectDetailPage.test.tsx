import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { apiJson, renderApp, stubApi } from "../test/render";
import { detail, milestone } from "../test/fixtures";
import { violations } from "../test/axe";

const path = "/projects/a1000000-0000-4000-8000-000000000001";

describe("ProjectDetailPage", () => {
  it("shows project facts and milestones", async () => {
    stubApi();
    const { container } = renderApp(path);
    expect(await screen.findByText("Synthetic example project.")).toBeInTheDocument();
    expect(screen.getByText("$4,850,000.00")).toBeInTheDocument();
    expect(screen.getByText("Mar 1, 2026")).toBeInTheDocument();
    const rows = within(screen.getByRole("table", { name: "Milestones" })).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[2]!).getByText("In progress")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Not set")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });
  it("handles projects without milestones", async () => {
    stubApi(() => apiJson(detail({ milestones: [] })));
    renderApp(path);
    expect(await screen.findByText("No milestones recorded.")).toBeInTheDocument();
  });
  it("renders a single milestone", async () => {
    stubApi(() => apiJson(detail({ milestones: [milestone()] })));
    renderApp(path);
    expect(await screen.findByText("Design approved")).toBeInTheDocument();
  });
  it("shows a loading state and then a not-found error with a way back", async () => {
    stubApi(() => apiJson({ error: "project_not_found" }, 404));
    const { container } = renderApp(path);
    expect(screen.getByText("Loading project...")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("That item was not found.");
    expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute("href", "/projects");
    expect(await violations(container)).toEqual([]);
  });
  it("shows a network failure", async () => {
    stubApi(() => { throw new TypeError("offline"); });
    renderApp(path);
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your connection");
  });
  it("retries a detail request after a temporary failure", async () => {
    let failed = true;
    stubApi(() => failed ? apiJson({}, 500) : apiJson(detail()));
    renderApp(path);
    await screen.findByRole("alert");
    failed = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Synthetic example project.")).toBeInTheDocument();
  });
});
