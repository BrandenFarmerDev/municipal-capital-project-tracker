import { useEffect, type ReactNode } from "react";
import { APP_NAME } from "../content/app";

export interface PageHeaderProps { title: string; description?: string; actions?: ReactNode }

// The heading is focusable so the shell can move focus here after a route change.
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  useEffect(() => { document.title = `${title} – ${APP_NAME}`; }, [title]);
  return <header className="qe-page-header">
    <div>
      <h1 tabIndex={-1}>{title}</h1>
      {description && <p className="qe-page-description">{description}</p>}
    </div>
    {actions && <div className="qe-cluster">{actions}</div>}
  </header>;
}
