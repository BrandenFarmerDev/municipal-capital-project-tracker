import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { ThemeSelect } from "./ThemeSelect";

describe("ThemeSelect", () => {
  it("follows changes to the system theme and cleans up its listener", () => {
    const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", () => media);
    const { unmount } = render(<ThemeSelect />);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    media.matches = true;
    act(() => media.addEventListener.mock.calls[0]![1]());
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", media.addEventListener.mock.calls[0]![1]);
  });

  it("persists an explicit selection and restores system preference", async () => {
    const { unmount } = render(<ThemeSelect />);
    await userEvent.selectOptions(screen.getByLabelText("Theme"), "dark");
    expect(localStorage.getItem("mct-theme")).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    unmount();
    render(<ThemeSelect />);
    expect(screen.getByLabelText("Theme")).toHaveValue("dark");
    await userEvent.selectOptions(screen.getByLabelText("Theme"), "light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await userEvent.selectOptions(screen.getByLabelText("Theme"), "system");
    expect(screen.getByLabelText("Theme")).toHaveValue("system");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("still switches themes when browser storage is unavailable", async () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("disabled"); });
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("disabled"); });
    render(<ThemeSelect />);
    await userEvent.selectOptions(screen.getByLabelText("Theme"), "dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    read.mockRestore();
    write.mockRestore();
  });
});

describe("theme before first paint", () => {
  const bootstrap = readFileSync(resolve(process.cwd(), "public/theme.js"), "utf8");
  it.each([
    ["dark", false, "dark"], ["light", true, "light"], ["system", true, "dark"], ["invalid", false, "light"],
  ])("resolves stored %s and system dark=%s to %s", (saved, matches, expected) => {
    const document = { documentElement: { dataset: { theme: "" } } };
    runInNewContext(bootstrap, { document, localStorage: { getItem: () => saved }, matchMedia: () => ({ matches }) });
    expect(document.documentElement.dataset.theme).toBe(expected);
  });
  it("uses the system when storage is disabled", () => {
    const document = { documentElement: { dataset: { theme: "" } } };
    runInNewContext(bootstrap, { document, localStorage: { getItem: () => { throw new Error("disabled"); } }, matchMedia: () => ({ matches: true }) });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
