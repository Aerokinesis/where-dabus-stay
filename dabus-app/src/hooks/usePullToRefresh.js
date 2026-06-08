import { useState, useEffect, useRef } from "react";

const THRESHOLD = 80;
// Minimum downward movement before we commit to pull-to-refresh and block
// native scrolling. Keeps diagonal/accidental touches from locking scroll.
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
  // The scrollable container the touch started inside (if any).
  const scrollAncestor = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e) => {
      if (e.touches.length > 1) return;
      // Don't capture touches that started inside a Leaflet map — they're map
      // drags (or pinch-zooms), not pull-to-refresh gestures.
      if (e.target.closest?.(".leaflet-container")) return;

      // Find the nearest scrollable container for this touch.
      const ancestor = getScrollableAncestor(e.target);
      scrollAncestor.current = ancestor;

      // If the touch started inside a container that's already scrolled down,
      // the user is navigating that content — don't intercept.
      if (ancestor && ancestor.scrollTop > 0) return;

      startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 1) {
        startY.current = null;
        scrollAncestor.current = null;
        setIsPulling(false);
        setPullDistance(0);
        return;
      }
      if (startY.current === null) return;
      const distance = e.touches[0].clientY - startY.current;
      if (distance <= 0) return;

      // Re-check scroll position in real-time: if the container scrolled since
