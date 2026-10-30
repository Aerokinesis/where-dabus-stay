import { useState } from "react";

const STORAGE_KEY = "dabus-stop-history";
const MAX_HISTORY = 25;

export function useStopHistory() {
  const [stopHistory, setStopHistory] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Only stops that actually loaded go in history. fetchArrivals resolves to
  // the stop's name on success (always set: it falls back to "Stop #N") and
  // to null/undefined when the stop doesn't exist or the request failed, so a
  // mistyped stop number never shows up under Recent.
  const addToHistory = (stopId, stopName) => {
    if (!stopName) return;
    const entry = { stopId, stopName };
    const updated = [
      entry,
      ...stopHistory.filter((s) => s.stopId !== stopId),
    ].slice(0, MAX_HISTORY);
    setStopHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearHistory = () => {
    setStopHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const removeFromHistory = (stopId) => {
    const updated = stopHistory.filter((s) => s.stopId !== stopId);
    setStopHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return { stopHistory, addToHistory, removeFromHistory, clearHistory };
}