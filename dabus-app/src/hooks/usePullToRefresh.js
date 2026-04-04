import { useState, useEffect, useRef } from "react";

const THRESHOLD = 80; // px to pull before triggering refresh

export function usePullToRefresh(onRefresh, enabled) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e) => {
      // Only start tracking if we're at the top of the page
      if (window.scrollY !== 0) return;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (startY.current === null) return;
      const distance = e.touches[0].clientY - startY.current;
      if (distance <= 0) return;
      setPullDistance(Math.min(distance, THRESHOLD));
      setIsPulling(true);
    };

    const handleTouchEnd = () => {
      if (pullDistance >= THRESHOLD) {
        onRefresh();
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

  return { isPulling, pullDistance };
}