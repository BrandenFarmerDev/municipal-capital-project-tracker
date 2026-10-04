import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsync } from "./use-async";

describe("useAsync", () => {
  it("aborts an obsolete load and ignores a late result", async () => {
    let resolveFirst!: (value: string) => void;
    let firstSignal!: AbortSignal;
    const first = (signal: AbortSignal) => {
      firstSignal = signal;
      return new Promise<string>((resolve) => { resolveFirst = resolve; });
    };
    const second = async () => "current";
    const { result, rerender } = renderHook(({ load }) => useAsync(load), { initialProps: { load: first } });
    rerender({ load: second });
    await waitFor(() => expect(result.current).toEqual({ status: "success", data: "current" }));
    expect(firstSignal.aborted).toBe(true);
    await act(async () => { resolveFirst("obsolete"); });
    expect(result.current).toEqual({ status: "success", data: "current" });
  });
  it("uses an explicit retry without changing the loader", async () => {
    const load = vi.fn(async () => "loaded");
    const { result, rerender } = renderHook(({ attempt }) => useAsync(load, attempt), { initialProps: { attempt: 0 } });
    await waitFor(() => expect(result.current.status).toBe("success"));
    rerender({ attempt: 1 });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe("success"));
  });
});
