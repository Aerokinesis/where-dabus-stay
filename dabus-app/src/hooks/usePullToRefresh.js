import { useState, useEffect, useRef } from "react";

const THRESHOLD = 80;

// Walk up the DOM from `el` and return the first scrollable ancestor.
// Returns null if none found before <body>.
function getScrollableAncestor(el) {
  while (el && el !== document.body) {
    const oy = window.getComputedStyle(el).overflowY;
    if ((oy === "scroll" || oy === "auto") && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function usePullToRefresh(onRefresh, enabled) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const startY = useRef(null);
  // Ref so handleTouchEnd always reads the latest value (state is stale in closures).
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e) => {
      if (e.touches.length > 1) return;
      // Don't capture touches that started inside a Leaflet map — they're map
      // drags (or pinch-zooms), not pull-to-refresh gestures.
      if (e.target.closest?.(".leaflet-container")) return;
      // If the touch started inside a scrollable container that's already
      // scrolled down, the user is scrolling back up — don't intercept.
      const ancestor = getScrollableAncestor(e.target);
      if (ancestor && ancestor.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 1) {
        startY.current = null;
        setIsPulling(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }
      if (startY.current === null) return;
      const distance = e.touches[0].clientY - startY.current;
      if (distance <= 0) return;
      // Prevent the browser's native pull-to-refresh / overscroll from firing
      // while we're handling the gesture ourselves.
      e.preventDefault();
      const clamped = Math.min(distance, THRESHOLD);
      pullDistanceRef.current = clamped;
      setPullDistance(clamped);
      setIsPulling(true);
    };

    const handleTouchEnd = () => {
      if (pullDistanceRef.current >= THRESHOLD) {
        onRefreshRef.current?.();
        setTriggered(true);
        setTimeout(() => setTriggered(false), 700);
      }
      startY.current = null;
      pullDistanceRef.current = 0;
      setIsPulling(false);
      setPullDistance(0);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    // passive: false is required so we can call preventDefault() and suppress
    // the browser's native pull-to-refresh / overscroll during a pull gesture.
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove, { passive: false });
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled]);

  return { isPulling, pullDistance, triggered };
}
