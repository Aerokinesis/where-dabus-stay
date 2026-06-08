import { useState, useEffect, useRef } from "react";

const THRESHOLD = 80;
// Don't show the indicator until the user has pulled at least this far.
// This avoids showing it for a slight downward twitch at the start of a scroll.
const DEADZONE = 8;

// Walk up the DOM from `el` and return the first element that has scrollable
// overflow and actual overflow content. Returns null if none found before body.
function getScrollableAncestor(el) {
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if (
      (overflowY === "scroll" || overflowY === "auto") &&
      el.scrollHeight > el.clientHeight
    ) {
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

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e) => {
      if (e.touches.length > 1) return;
      // Don't capture touches that started inside a Leaflet map -- they're map
      // drags (or pinch-zooms), not pull-to-refresh gestures.
      if (e.target.closest?.(".leaflet-container")) return;

      // If the touch started inside a scrollable container that's already
      // scrolled down, the user is navigating that content -- don't intercept.
      const ancestor = getScrollableAncestor(e.target);
      if (ancestor && ancestor.scrollTop > 0) return;

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

      // Block native scroll immediately on any downward movement so the browser
      // can't start scrolling the container (which would bump scrollTop and
      // prevent us from ever showing the indicator).
      e.preventDefault();

      // Don't show the indicator until past the deadzone.
      if (distance < DEADZONE) return;

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
  }, [enabled, onRefresh, pullDistance]);

  return { isPulling, pullDistance, triggered };
}
