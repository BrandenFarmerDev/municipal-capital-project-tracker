import { useCallback, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StateMessage } from "../components/StateMessage";
import { StatusBadge } from "../components/StatusBadge";
import { getProject } from "../lib/api";
import { formatBudget, formatDate, labelFor } from "../lib/format";
import { useAsync } from "../lib/use-async";
import { projectsReturnPath } from "../lib/projects-return-path";

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const returnPath = projectsReturnPath(useLocation().state);
  const [attempt, setAttempt] = useState(0);
  const state = useAsync(useCallback((signal: AbortSignal) => getProject(projectId, signal), [projectId]), attempt);
  if (state.status !== "success") {
    return <>
      <PageHeader title="Project" />
      <StateMessage state={state} loading="Loading project..." retry={() => setAttempt((value) => value + 1)} />
      <p><Link className="qe-button" to={returnPath}>Back to projects</Link></p>
    </>;
  }
  const project = state.data;
  return <>
    <PageHeader title={project.name} description={project.projectNumber} />
    <p>{project.description}</p>
    <dl className="qe-facts">
      <div><dt>Phase</dt><dd>{labelFor(project.phase)}</dd></div>
      <div><dt>Status</dt><dd><StatusBadge status={project.status} /></dd></div>
      <div><dt>Department</dt><dd>{project.department}</dd></div>
      <div><dt>Approved budget</dt><dd>{formatBudget(project.approvedBudget, project.currencyCode)}</dd></div>
      <div><dt>Planned start</dt><dd>{formatDate(project.plannedStartDate)}</dd></div>
      <div><dt>Planned completion</dt><dd>{formatDate(project.plannedCompletionDate)}</dd></div>
    </dl>
    <h2>Milestones</h2>
    {project.milestones.length === 0
      ? <p className="qe-notice" data-tone="info" role="status">No milestones recorded.</p>
      : <><p className="qe-table-hint" id="milestone-table-help">Scroll horizontally to view all columns on smaller screens.</p>
        <div className="qe-table-region" role="region" aria-label="Milestone table" aria-describedby="milestone-table-help" tabIndex={0}><table className="qe-table">
        <caption className="qe-visually-hidden">Milestones</caption>
        <thead><tr><th className="qe-numeric" scope="col">#</th><th className="qe-table-identity" scope="col">Milestone</th><th scope="col">Status</th><th scope="col">Planned</th><th scope="col">Actual</th></tr></thead>
        <tbody>{project.milestones.map((milestone) => <tr key={milestone.id}>
          <td className="qe-numeric">{milestone.sequence}</td><th scope="row">{milestone.name}</th><td>{labelFor(milestone.status)}</td>
          <td>{formatDate(milestone.plannedDate)}</td><td>{formatDate(milestone.actualDate)}</td>
        </tr>)}</tbody>
      </table></div></>}
    <p><Link className="qe-button" to={returnPath}>Back to projects</Link></p>
  </>;
}
