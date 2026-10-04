import { useEffect, useState } from "react";
import { getApiHealth } from "../lib/api";

type Status = { tone: "info" | "success" | "warning"; text: string };

export function ApiStatus() {
  const [status, setStatus] = useState<Status>({ tone: "info", text: "Checking API connection…" });
  useEffect(() => {
    const controller = new AbortController();
    getApiHealth(controller.signal)
      .then(() => { if (!controller.signal.aborted) setStatus({ tone: "success", text: "API connected" }); })
      .catch(() => { if (!controller.signal.aborted) setStatus({ tone: "warning", text: "API unavailable. Reload the page to try again, or contact the application owner if the problem continues." }); });
    return () => controller.abort();
  }, []);
  return <p className="qe-notice" data-tone={status.tone} role="status">{status.text}</p>;
}
