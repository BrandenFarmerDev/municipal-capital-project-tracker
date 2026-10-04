import type { ProjectStatus } from "@municipal-tracker/shared";
import { labelFor } from "../lib/format";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className="qe-badge" data-status={status}>{labelFor(status)}</span>;
}
