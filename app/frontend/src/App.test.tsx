import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { apiJson, renderApp, stubApi } from "./test/render";
import { violations } from "./test/axe";

describe("routes", () => {
  it.each([
    ["/", "Capital project tracker", "Capital project tracker"],
    ["/projects", "Projects", "Projects"],
    ["/projects/a1000000-0000-4000-8000-000000000001", "Mesa Street Water Main Replacement (fictional)", "Mesa Street Water Main Replacement (fictional)"],
    ["/nowhere", "Page not found", "Page not found"],
  ])("renders %s with its heading and document title", async (path, heading, title) => {
    stubApi();
    renderApp(path);
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    // The title is set by a passive effect (PageHeader), which can run after the heading commits.
    await waitFor(() => expect(document.title).toBe(`${title} \u2013 Municipal Capital Project Tracker`));
  });
  it("offers a way back from the not-found page", () => {
    stubApi();
    renderApp("/nowhere");
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
  });
});

describe("shell", () => {
  it("has a skip link, landmarks, and a synthetic-data notice", () => {
    stubApi();
    renderApp("/");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByText(/fictional data only/)).toBeInTheDocument();
  });
  it("marks the current page and moves focus to the new heading after navigation, but not on first load", async () => {
    stubApi();
    renderApp("/");
    const first = await screen.findByRole("heading", { level: 1 });
    expect(first).not.toHaveFocus();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("link", { name: "Projects" }));
    const next = await screen.findByRole("heading", { level: 1, name: "Projects" });
    await waitFor(() => expect(next).toHaveFocus());
    expect(screen.getByTestId("location")).toHaveTextContent("/projects");
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
  it("has no automated accessibility violations", async () => {
    stubApi(() => apiJson({ items: [], nextCursor: null }));
    const { container } = renderApp("/projects");
    await screen.findByText("No projects recorded on this page.");
    expect(await violations(container)).toEqual([]);
  });
});
