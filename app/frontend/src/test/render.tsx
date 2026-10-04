import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { App } from "../App";
import { detail, health, summary } from "./fixtures";

export const apiJson = (body: unknown, status = 200) => Response.json(body, { status });
type Handler = (url: URL) => Response | Promise<Response>;

export function defaultApi(url: URL): Response {
  if (url.pathname === "/api/health") return apiJson(health);
  if (url.pathname === "/api/projects") return apiJson({ items: [summary()], nextCursor: null });
  return apiJson(detail());
}

// Replaces fetch so no test touches the network; returns the mock for call assertions.
export function stubApi(handler: Handler = defaultApi) {
  const mock = vi.fn(async (input: RequestInfo | URL) => handler(new URL(String(input), "http://localhost")));
  vi.stubGlobal("fetch", mock);
  return mock;
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

export function renderApp(path = "/") {
  return render(<MemoryRouter initialEntries={[path]}><App /><LocationProbe /></MemoryRouter>);
}
