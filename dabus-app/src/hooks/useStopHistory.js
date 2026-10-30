import { useState, useEffect } from "react";
import { API_BASE } from "../constants";
import { formatStopName } from "./useArrivals";

const STORAGE_KEY = "dabus-stop-history";
const MAX_HISTORY = 25;

export function useStopHistory() {
  const [stopHistory, setStopHistory] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Entries saved without a name are either a stop number that didn't exist
  // (saved before addToHistory skipped failed lookups) or a real stop from
  // before history stored names at all. Look each one up once on startup:
  // drop the ones the server says don't exist, fill in names for the rest.
  // Network failures leave the entry alone to retry next launch.
  useEffect(() => {
    const unnamed = stopHistory.filter((s) => !s.stopName).map((s) => s.stopId);
    if (unnamed.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        unnamed.map(async (stopId) => {
          try {
            const res = await fetch(`${API_BASE}/api/stop/${stopId}`);
            // Only the API's own "Stop not found" counts as missing, so a
            // hosting error page that also happens to be a 404 can't wipe
            // real stops.
            if (res.status === 404) {
              const body = await res.json().catch(() => null);
              return [stopId, body?.error === "Stop not found" ? { missing: true } : null];
            }
            if (!res.ok) return [stopId, null];
            const data = await res.json();
            return [stopId, { name: formatStopName(data.stop_name, stopId) }];
          } catch {
            return [stopId, null];
          }
        }),
      );
      if (cancelled) return;
      const found = new Map(results.filter(([, r]) => r));
      if (found.size === 0) return;
      updateHistory((current) =>
        current
          .filter((s) => !found.get(s.stopId)?.missing)
          .map((s) => (!s.stopName && found.get(s.stopId)?.name
            ? { ...s, stopName: found.get(s.stopId).name }
            : s)),
      );
    })();
    return () => {
      cancelled = true;
    };
    // Startup only: entries added later always carry a name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Updates go through the latest state (not this render's `stopHistory`):
  // an add made from an async callback, like a stop opened from a deep link,
  // would otherwise write an out-of-date list over the startup cleanup above.
  const updateHistory = (change) => {
    setStopHistory((current) => {
      const updated = change(current);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Only stops that actually loaded go in history. fetchArrivals resolves to
  // the stop's name on success (always set: it falls back to "Stop #N") and
  // to null/undefined when the stop doesn't exist or the request failed, so a
  // mistyped stop number never shows up under Recent.
  const addToHistory = (stopId, stopName) => {
    if (!stopName) return;
    const entry = { stopId, stopName };
    updateHistory((current) =>
      [entry, ...current.filter((s) => s.stopId !== stopId)].slice(0, MAX_HISTORY),
    );
  };

  const clearHistory = () => {
    setStopHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const removeFromHistory = (stopId) => {
    updateHistory((current) => current.filter((s) => s.stopId !== stopId));
  };

  return { stopHistory, addToHistory, removeFromHistory, clearHistory };
}