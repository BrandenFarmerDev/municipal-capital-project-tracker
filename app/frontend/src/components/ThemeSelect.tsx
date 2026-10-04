import { useEffect, useState } from "react";

type Preference = "light" | "dark" | "system";

function readPreference(): Preference {
  try {
    const saved = localStorage.getItem("mct-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Theme controls remain available when storage is disabled.
  }
  return "system";
}

export function ThemeSelect() {
  const [preference, setPreference] = useState<Preference>(readPreference);
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.add("qe-app");
      document.documentElement.dataset.theme = preference === "system" ? (system.matches ? "dark" : "light") : preference;
    };
    apply();
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [preference]);
  const change = (value: Preference) => {
    setPreference(value);
    try { localStorage.setItem("mct-theme", value); } catch { /* The selected theme still applies for this session. */ }
  };
  return <label className="qe-field qe-theme-field">Theme
    <select className="qe-select" value={preference} onChange={(event) => change(event.target.value as Preference)}>
      <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
    </select>
  </label>;
}
