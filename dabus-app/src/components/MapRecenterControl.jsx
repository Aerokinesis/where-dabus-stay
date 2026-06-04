import { useEffect } from "react";
import { useMap } from "react-leaflet";

const isFinitePair = (p) =>
  Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));

// Shared map-recenter control. Watches a counter prop and animates the map
// either to a single point (`center`) or fits the viewport to a set of
// coordinates (`bounds`). The counter starts at 0 — increment from the
// consumer to trigger an animation. trigger===0 is skipped so the
// initial mount (and React StrictMode's simulated remount in dev) does
// nothing.
function MapRecenterControl({ trigger, center, bounds, minZoom = 15, padding = 40, duration = 0.6 }) {
  const map = useMap();

  useEffect(() => {
    if (trigger === 0) return;

    // Single-point mode
    if (center && isFinitePair(center)) {
      const [lat, lng] = center;
      map.flyTo([Number(lat), Number(lng)], Math.max(map.getZoom(), minZoom), { duration });
      return;
    }

    // Fit-bounds mode
    if (Array.isArray(bounds) && bounds.length > 0) {
      const valid = bounds.filter(isFinitePair).map((p) => [Number(p[0]), Number(p[1])]);
      if (valid.length > 0) {
        map.flyToBounds(valid, { padding: [padding, padding], duration });
      }
    }
  }, [trigger]);

  return null;
}

export default MapRecenterControl;
