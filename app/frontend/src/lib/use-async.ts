import { useEffect, useState } from "react";
import { errorMessage } from "./api";

export type AsyncState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: T };

/** Runs `load` whenever its identity changes (wrap it in useCallback); stale results are ignored. */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, attempt = 0): AsyncState<T> {
  const [settled, setSettled] = useState<{ load: typeof load; attempt: number; state: AsyncState<T> } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const settle = (state: AsyncState<T>) => { if (!controller.signal.aborted) setSettled({ load, attempt, state }); };
    load(controller.signal).then((data) => settle({ status: "success", data }), (reason: unknown) => settle({ status: "error", message: errorMessage(reason) }));
    return () => controller.abort();
  }, [load, attempt]);
  return settled?.load === load && settled.attempt === attempt ? settled.state : { status: "loading" };
}
