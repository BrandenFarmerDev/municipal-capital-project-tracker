import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { apiJson, renderApp, stubApi } from "../test/render";
import { summary } from "../test/fixtures";
import { violations } from "../test/axe";

describe("ProjectsPage", () => {
  it("shows a loading state and then the project table", async () => {
    stubApi();
    const { container } = renderApp("/projects");
    expect(screen.getByText("Loading projects...")).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Capital projects" });
    const row = within(table).getAllByRole("row")[1]!;
    expect(within(row).getByRole("link", { name: /Mesa Street/ })).toHaveAttribute("href", "/projects/a1000000-0000-4000-8000-000000000001");
    expect(within(row).getByText("On track")).toBeInTheDocument();
    expect(within(row).getByText("$4,850,000.00")).toBeInTheDocument();
    expect(within(row).getByText("Feb 15, 2027")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });
  it("shows an empty state", async () => {
    stubApi(() => apiJson({ items: [], nextCursor: null }));
    renderApp("/projects");
    expect(await screen.findByText("No projects recorded on this page.")).toBeInTheDocument();
  });
  it.each([[401, "Sign in"], [503, "temporarily unavailable"], [500, "could not be completed"]])("shows an error for status %s", async (status, text) => {
    stubApi(() => apiJson({ error: "x" }, status));
    const { container } = renderApp("/projects");
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(await violations(container)).toEqual([]);
  });
  it("sends filters to the API and resets to the first page", async () => {
    const fetcher = stubApi();
    renderApp("/projects");
    await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText("Phase"), "design");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "delayed");
    await screen.findByRole("table");
    expect(fetcher.mock.calls.map(([url]) => String(url)).at(-1)).toBe("/api/projects?phase=design&status=delayed");
  });
  it("walks forward and back through cursor pages", async () => {
    const fetcher = stubApi((url) => {
      if (url.pathname !== "/api/projects") return apiJson({});
      return url.searchParams.get("cursor") === "next"
        ? apiJson({ items: [summary({ id: "a2", name: "Second page project", projectNumber: "P2", plannedCompletionDate: null })], nextCursor: null })
        : apiJson({ items: [summary()], nextCursor: "next" });
    });
    renderApp("/projects");
    await screen.findByText(/Mesa Street/);
    const nav = () => within(screen.getByRole("navigation", { name: "Pagination" }));
    expect(nav().getByRole("button", { name: "Previous page" })).toBeDisabled();
    await userEvent.click(nav().getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Second page project")).toBeInTheDocument();
    expect(nav().getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(String(fetcher.mock.calls.at(-1)![0])).toBe("/api/projects?cursor=next");
    await userEvent.click(nav().getByRole("button", { name: "Previous page" }));
    expect(await screen.findByText(/Mesa Street/)).toBeInTheDocument();
  });
  it("distinguishes filtered-empty results and clears all filters", async () => {
    stubApi((url) => apiJson({ items: url.search ? [] : [summary()], nextCursor: null }));
    renderApp("/projects");
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "delayed");
    expect(await screen.findByText(/No projects match these filters/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await screen.findByRole("table");
    expect(screen.getByLabelText("Status")).toHaveValue("");
  });
  it("retries a failed request while preserving filters", async () => {
    let failed = true;
    const fetcher = stubApi(() => failed ? apiJson({}, 500) : apiJson({ items: [summary()], nextCursor: null }));
    renderApp("/projects");
    await screen.findByRole("alert");
    await userEvent.selectOptions(screen.getByLabelText("Phase"), "design");
    await screen.findByRole("alert");
    failed = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("table");
    expect(screen.getByLabelText("Phase")).toHaveValue("design");
    expect(String(fetcher.mock.calls.at(-1)![0])).toBe("/api/projects?phase=design");
  });
  it("keeps pagination usable when a later page has become empty", async () => {
    stubApi((url) => apiJson({ items: url.searchParams.has("cursor") ? [] : [summary()], nextCursor: url.searchParams.has("cursor") ? null : "next" }));
    renderApp("/projects");
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("No projects recorded on this page.");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await screen.findByRole("table");
  });
  it("renders a malformed response as a recoverable error", async () => {
    stubApi(() => apiJson({ items: [null], nextCursor: null }));
    renderApp("/projects");
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid project list");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
