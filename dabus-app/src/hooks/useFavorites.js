import { useState } from "react";

const STORAGE_KEY = "dabus-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const persist = (updated) => {
    setFavorites(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const saveToFavorites = (currentStop, customName) => {
    if (!currentStop) return;
    const newFavorite = {
      stop_id: currentStop.id,
      name: currentStop.name,
      custom_name: customName,
    };
    persist([...favorites.filter((f) => f.stop_id !== currentStop.id), newFavorite]);
  };

  const removeFavorite = (stopId) => {
    persist(favorites.filter((f) => f.stop_id !== stopId));
  };

  const isCurrentStopFavorited = (currentStop) => {
    return favorites.some((f) => f.stop_id === currentStop?.id);
  };

  return { favorites, saveToFavorites, removeFavorite, isCurrentStopFavorited };
}
