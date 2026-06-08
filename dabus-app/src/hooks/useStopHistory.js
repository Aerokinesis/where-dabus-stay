import { useState } from "react";

const STORAGE_KEY = "dabus-stop-history";
const MAX_HISTORY = 10;

export function useStopHistory() {
  const [stopHistory, setStopHistory] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const addToHistory = (stopId, stopName) => {
    const entry = { stopId, stopName: stopName || null };
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