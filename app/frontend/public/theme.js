(() => {
  let preference = "system";
  try {
    const saved = localStorage.getItem("mct-theme");
    if (saved === "light" || saved === "dark") preference = saved;
  } catch {
    // Storage may be disabled; system preference still applies before first paint.
  }
  document.documentElement.dataset.theme = preference === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
})();
