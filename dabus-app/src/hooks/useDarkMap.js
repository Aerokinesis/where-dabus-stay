import { useEffect, useState } from "react";

// True when the app is in dark mode (same rule as the colour tokens in
// index.css: dark unless the rider chose Light). Re-renders when Settings
// changes the theme.
const isDark = () => document.documentElement.getAttribute("data-theme") !== "light";

export function useDarkMap() {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}
