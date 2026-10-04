import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { APP_NAME, navItems, syntheticNotice } from "../content/app";
import { ThemeSelect } from "./ThemeSelect";

export function Layout() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const visited = useRef(pathname);
  useEffect(() => {
    if (visited.current === pathname) return;
    visited.current = pathname;
    main.current?.querySelector("h1")?.focus();
  }, [pathname]);
  return <>
    <a className="qe-skip-link" href="#main-content">Skip to main content</a>
    <header className="qe-shell-header">
      <p className="qe-brand">{APP_NAME}</p>
      <div className="qe-shell-utilities"><nav aria-label="Primary">
        <ul className="qe-nav">{navItems.map((item) => <li key={item.to}>
          <NavLink to={item.to} end={item.end}>{item.label}</NavLink>
        </li>)}</ul>
      </nav><ThemeSelect /></div>
    </header>
    <main className="qe-container" id="main-content" ref={main} tabIndex={-1}><Outlet /></main>
    <footer className="qe-shell-footer qe-container"><p>{syntheticNotice}</p></footer>
  </>;
}
