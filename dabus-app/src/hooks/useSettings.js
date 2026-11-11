import { useState, useEffect } from "react";
import { followTheme } from "../theme";

const STORAGE_KEY = "dabus-settings";

const defaults = {
  theme: "system",
  searchRadius: 0.25,
  arrivalsView: "list", // "list" | "grouped"
};

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  const updateSetting = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // "system" used to just drop data-theme, which always meant dark; now it
  // follows the device's light/dark appearance (see theme.js).
  useEffect(() => followTheme(settings.theme), [settings.theme]);

  return { settings, updateSetting };
}