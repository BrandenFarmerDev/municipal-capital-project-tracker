import type { AsyncState } from "../lib/use-async";

export function StateMessage({ state, loading, retry }: { state: AsyncState<unknown>; loading: string; retry: () => void }) {
  if (state.status === "loading") return <p className="qe-notice" data-tone="info" role="status">{loading}</p>;
  if (state.status === "error") return <div className="qe-notice" data-tone="danger" role="alert">
    <p>{state.message} Your current selection is preserved.</p>
    <button className="qe-button" type="button" onClick={retry}>Try again</button>
  </div>;
  return null;
}
