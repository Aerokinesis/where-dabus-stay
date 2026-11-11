// The app's colour theme. The rider's setting is "light", "dark" or "system";
// the page always gets a definite data-theme ("light" or "dark") so CSS has a
// single switch. "system" follows the device's appearance setting, and keeps
// following it while the app is open (e.g. a phone switching at sunset).

const STORAGE_KEY = "dabus-settings";

const lightQuery = () => window.matchMedia?.("(prefers-color-scheme: light)");

// "light" | "dark" for a setting. Where the device can't say, stays dark (the
// app's original look).
export function resolveTheme(setting) {
  if (setting === "light" || setting === "dark") return setting;
  return lightQuery()?.matches ? "light" : "dark";
}

export function applyTheme(setting) {
  document.documentElement.setAttribute("data-theme", resolveTheme(setting));
}

// The saved setting, for code that runs outside useSettings (startup, /admin).
export function savedThemeSetting() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").theme || "system";
  } catch {
    return "system";
  }
}

// Applies `setting` now and, for "system", again whenever the device's
// appearance changes. Returns a cleanup function (for useEffect).
export function followTheme(setting) {
  applyTheme(setting);
  const query = setting === "system" ? lightQuery() : null;
  if (!query) return () => {};
  const onChange = () => applyTheme("system");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
