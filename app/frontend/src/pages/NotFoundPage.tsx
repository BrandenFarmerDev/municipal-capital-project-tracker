import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";

export function NotFoundPage() {
  return <>
    <PageHeader title="Page not found" description="This page is not part of the tracker." />
    <p><Link className="qe-button" to="/">Return home</Link></p>
  </>;
}
