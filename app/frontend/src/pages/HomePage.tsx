import { Link } from "react-router-dom";
import { ApiStatus } from "../components/ApiStatus";
import { PageHeader } from "../components/PageHeader";
import { home } from "../content/app";

export function HomePage() {
  return <>
    <PageHeader title={home.title} description={home.description} />
    <ApiStatus />
    {home.details.map((detail) => <p key={detail}>{detail}</p>)}
    <p><Link className="qe-button" data-variant="primary" to="/projects">View projects</Link></p>
  </>;
}
