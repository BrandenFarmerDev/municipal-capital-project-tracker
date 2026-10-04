export function projectsReturnPath(state: unknown): string {
  if (typeof state !== "object" || state === null || !("projectSearch" in state) || typeof state.projectSearch !== "string" || !state.projectSearch) return "/projects";
  return `/projects?${new URLSearchParams(state.projectSearch)}`;
}
