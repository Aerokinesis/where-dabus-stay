import { useState, useEffect, useRef } from "react";

const THRESHOLD = 80;

export function usePullToRefresh(onRefresh, enabled) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const startY = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e) => {
      if (e.touches.length > 1) return;
      if (window.scrollY !== 0) return;
      // Don't capture touches that started inside a Leaflet map — they're map
      // drags (or pinch-zooms), not pull-to-refresh gestures.
      if (e.target.closest?.(".leaflet-container")) return;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 1) {
        startY.current = null;
        setIsPulling(false);
        setPullDistance(0);
        return;
      }
      if (startY.current === null) return;
      const distance = e.touches[0].clientY - startY.current;
      if (distance <= 0) return;
      setPullDistance(Math.min(distance, THRESHOLD));
      setIsPulling(true);
    };

    const handleTouchEnd = () => {
      if (pullDistance >= THRESHOLD) {
        onRefresh();
        setTriggered(true);
        setTimeout(() => setTriggered(false), 700);
      }
      startY.current = null;
      setIsPulling(false);
      setPullDistance(0);
    };

    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, onRefresh, pullDistance]);

  return { isPulling, pullDistance, triggered };
}