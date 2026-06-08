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

// onRefresh  -- callback to invoke when the user completes a pull gesture
// enabled    -- when false the hook is a no-op
// strict     -- when true:
//                 - skip pulls that start inside a scrollable container scrolled
//                   down (the user is navigating content, not refreshing)
//                 - exclude touches inside Leaflet maps (map pan/zoom)
//               Pass false for the home screen where the map fills most of the
//               view and there's no other pull surface.
export function usePullToRefresh(onRefresh, enabled, strict = true) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const startY = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e) => {
      if (e.touches.length > 1) return;

      if (strict) {
        // Exclude map touches — they're pan/zoom gestures, not refreshes.
        if (e.target.closest?.(".leaflet-container")) return;
        // Skip if the touch started inside a scrollable container already
        // scrolled down — the user is navigating that content.
        const ancestor = getScrollableAncestor(e.target);
        if (ancestor && ancestor.scrollTop > 0) return;
      }

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

      // Block native scroll/pan immediately on any downward movement so the
      // browser can't start scrolling (which would bump scrollTop and cancel
      // the gesture) or the map from panning.
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
  }, [enabled, strict, onRefresh, pullDistance]);

  return { isPulling, pullDistance, triggered };
}
