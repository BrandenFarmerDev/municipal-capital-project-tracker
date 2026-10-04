import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { PROJECT_PHASES, PROJECT_STATUSES, type ProjectPhase, type ProjectStatus } from "@municipal-tracker/shared";
import { PageHeader } from "../components/PageHeader";
import { StateMessage } from "../components/StateMessage";
import { StatusBadge } from "../components/StatusBadge";
import { listProjects } from "../lib/api";
import { formatBudget, formatDate, labelFor } from "../lib/format";
import { useAsync } from "../lib/use-async";

export function ProjectsPage() {
  const [phase, setPhase] = useState<ProjectPhase | "">("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  // Cursor stack: each entry opens the page after the previous one; empty means the first page.
  const [cursors, setCursors] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const cursor = cursors.at(-1);
  const state = useAsync(useCallback((signal: AbortSignal) => listProjects({ phase, status, cursor }, signal), [phase, status, cursor]), attempt);
  const nextCursor = state.status === "success" ? state.data.nextCursor : null;
  const filter = <T extends string>(set: (value: T) => void) => (event: { target: { value: string } }) => { set(event.target.value as T); setCursors([]); };
  return <>
    <PageHeader title="Projects" description="Synthetic capital projects, oldest first." />
    <form className="qe-filters qe-cluster" aria-label="Project filters" onSubmit={(event) => event.preventDefault()}>
      <label className="qe-field">Phase
        <select className="qe-select" value={phase} onChange={filter<ProjectPhase | "">(setPhase)}>
          <option value="">All phases</option>
          {PROJECT_PHASES.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}
        </select>
      </label>
      <label className="qe-field">Status
        <select className="qe-select" value={status} onChange={filter<ProjectStatus | "">(setStatus)}>
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}
        </select>
      </label>
      <button className="qe-button" type="button" disabled={!phase && !status} onClick={() => { setPhase(""); setStatus(""); setCursors([]); }}>Clear filters</button>
    </form>
    <StateMessage state={state} loading="Loading projects..." retry={() => setAttempt((value) => value + 1)} />
    {state.status === "success" && <p role="status">Page {cursors.length + 1}: {state.data.items.length} projects shown. Sorted oldest first.</p>}
    {state.status === "success" && (state.data.items.length === 0
      ? <p className="qe-notice" data-tone="info" role="status">{phase || status ? "No projects match these filters. Clear or adjust the filters to see more projects." : "No projects recorded on this page."}</p>
      : <>
        <p className="qe-table-hint" id="project-table-help">Scroll horizontally to view all columns on smaller screens.</p>
        <div className="qe-table-region" role="region" aria-label="Capital project table" aria-describedby="project-table-help" tabIndex={0}><table className="qe-table">
          <caption className="qe-visually-hidden">Capital projects</caption>
          <thead><tr><th className="qe-table-identity" scope="col">Project</th><th scope="col">Phase</th><th scope="col">Status</th><th scope="col">Department</th><th className="qe-numeric" scope="col">Approved budget</th><th scope="col">Planned completion</th></tr></thead>
          <tbody>{state.data.items.map((project) => <tr key={project.id}>
            <th scope="row"><Link to={`/projects/${project.id}`}>{project.name}</Link><span className="qe-muted">{project.projectNumber}</span></th>
            <td>{labelFor(project.phase)}</td>
            <td><StatusBadge status={project.status} /></td>
            <td>{project.department}</td>
            <td className="qe-numeric">{formatBudget(project.approvedBudget, project.currencyCode)}</td>
            <td>{formatDate(project.plannedCompletionDate)}</td>
          </tr>)}</tbody>
        </table></div>
      </>)}
    <nav className="qe-pager qe-cluster" aria-label="Pagination">
      <button className="qe-button" type="button" disabled={cursors.length === 0 || state.status === "loading"} onClick={() => setCursors((values) => values.slice(0, -1))}>Previous page</button>
      <button className="qe-button" type="button" disabled={!nextCursor} onClick={() => { if (nextCursor) setCursors((values) => [...values, nextCursor]); }}>Next page</button>
    </nav>
  </>;
}
