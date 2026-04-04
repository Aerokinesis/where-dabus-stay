import { useState } from "react";

const STORAGE_KEY = "dabus-stop-history";
const MAX_HISTORY = 10;

export function useStopHistory() {
  const [stopHistory, setStopHistory] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const addToHistory = (stopId) => {
    const updated = [
      stopId,
      ...stopHistory.filter((id) => id !== stopId),
    ].slice(0, MAX_HISTORY);
    setStopHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearHistory = () => {
    setStopHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { stopHistory, addToHistory, clearHistory };
}