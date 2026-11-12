import { useState, useCallback, useRef } from "react";
import { API_BASE } from "../constants";

// The last location fix, kept on the device so the Nearby map can open where
// the user was last time while a new fix is found.
const LAST_LOCATION_KEY = "dabus-last-location";
const STALE_FIX_MS = 60 * 1000;
// How far a resume fix must be from the previous one before the map recenters.
// Wide enough to ignore the jitter of Wi-Fi positioning on a desktop.
const MOVED_M = 150;

function metersBetween(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function loadLastLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_LOCATION_KEY));
    if (Number.isFinite(saved?.lat) && Number.isFinite(saved?.lng)) return saved;
  } catch {
    // localStorage may be unavailable (Safari private mode, etc.) — ignore
  }
  return null;
}

function saveLastLocation(lat, lng) {
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ lat, lng }));
  } catch {
    // localStorage may be unavailable (Safari private mode, etc.) — ignore
  }
}

// Whether the location permission is already "granted", "denied", or still
// "prompt" (never asked). "unknown" where the Permissions API isn't available.
export async function geolocationPermission() {
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}

export function useNearbyStops(setError, searchRadius = 0.25) {
  const [nearbyStops, setNearbyStops] = useState(null);
  const [nearbyStopsMap, setNearbyStopsMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  // True only while waiting on a GPS fix the user can see is pending (not the
  // stops fetch after it, and not a quiet follow-up), for the map's indicator.
  const [findingLocation, setFindingLocation] = useState(false);

  // `quiet` is the search made while the user is still typing: it keeps the
  // current list on screen until the new one arrives, a miss just leaves no
  // list rather than raising an error mid-word, and a failed request changes
  // nothing. Enter still runs the loud version.
  // Answers can arrive out of order while typing, so only the latest search
  // (and none at all once the list has been cleared) may set the results.
  const searchSeq = useRef(0);

  const searchByAddress = async (query, { quiet = false } = {}) => {
    const seq = ++searchSeq.current;
    const isLatest = () => seq === searchSeq.current;
    if (!quiet) {
      setSearchingAddress(true);
      setError(null);
      setNearbyStops(null);
    }
    try {
      const res = await fetch(`${API_BASE}/api/search-stops?q=${encodeURIComponent(query)}`);
      // A typed search the server refused (rate limit, server error) is not
      // "no matches": keep the list that is already showing.
      if (quiet && !res.ok) return;
      const data = await res.json();
      if (!isLatest()) return;
      if (data.stops?.length) {
        // Results replace an earlier "No stops found" left by Enter.
        if (quiet) setError(null);
        setNearbyStops(data.stops);
      } else if (quiet) setNearbyStops(null);
      else if (data.error) setError(data.error);
      // Shown the same way as an unknown stop number rather than as a quiet
      // "No stops found." under the search bar.
      else setError(`No stops found for "${query}". Check the address and try again.`);
    } catch {
      if (!quiet && isLatest()) setError("Could not search for stops. Try again.");
    } finally {
      if (!quiet) setSearchingAddress(false);
    }
  };

  const refindNearbyStops = useCallback(async (lat, lon, radius) => {
    try {
      const res = await fetch(`${API_BASE}/api/nearby-stops-by-coords?lat=${lat}&lon=${lon}&radius=${radius}`);
      const data = await res.json();
      if (data.stops) setNearbyStopsMap(data.stops);
    } catch {
      setError("Could not find nearby stops.");
    }
  }, [setError]);

  // `recenter` rides along on the fix so the map knows whether to fly to it
  // (false for background re-fixes that shouldn't undo the user's panning).
  // `fresh` insists on a new GPS fix (refresh button, resume). Otherwise the
  // device may answer instantly from a fix up to 5 min old; if the one it
  // returns is over a minute old, a fresh fix follows quietly to correct it.
  // A non-fresh request made while another is still waiting joins it instead
  // of asking again (if either wants to recenter, the fix recenters). Two
  // requests in flight can resolve in the same tick, and React would then
  // batch their fixes so only the last one's `recenter` is ever seen, e.g.
  // tapping Home (recenter) racing the Home map's own background re-fix.
  // `recenter: "ifMoved"` recenters only when the fix is a real distance from
  // the previous one (resume: the user may have travelled, or may just have
  // switched tabs for a while and come back to a map they had panned).
  const pendingRequest = useRef(null);
  const lastFix = useRef(null);

  const findNearbyStops = ({ recenter = true, fresh = false, quiet = false } = {}) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    if (pendingRequest.current && !fresh) {
      if (recenter === true) pendingRequest.current.recenter = true;
      return;
    }
    const req = { recenter };
    pendingRequest.current = req;
    const settle = () => {
      if (pendingRequest.current === req) pendingRequest.current = null;
    };
    setLocating(true);
    if (!quiet) setFindingLocation(true);
    const onFix = async (position) => {
      settle();
      setFindingLocation(false);
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const recenterNow =
        req.recenter === "ifMoved"
          ? !lastFix.current || metersBetween(lastFix.current, { lat, lon }) > MOVED_M
          : req.recenter;
      lastFix.current = { lat, lon };
      setUserLocation({ lat, lon, recenter: recenterNow });
      saveLastLocation(lat, lon);
      const stale = !fresh && Date.now() - position.timestamp > STALE_FIX_MS;
      if (stale) findNearbyStops({ recenter: recenterNow, fresh: true, quiet: true });
      await refindNearbyStops(lat, lon, searchRadius);
      if (!stale) setLocating(false);
    };
    const onError = (err) => {
      settle();
      setFindingLocation(false);
      // A failed follow-up fix keeps the position we already have.
      if (quiet) {
        setLocating(false);
        return;
      }
      if (err.code === 1) {
        setError("Location access denied. Enable it in your browser settings, or search for a stop above.");
      } else if (err.code === 2) {
        setError("Unable to determine your location. You can search for a stop or address above.");
      } else {
        setError("Location request timed out. You can search for a stop or address above.");
      }
      setLocating(false);
    };

    const request = () =>
      navigator.geolocation.getCurrentPosition(onFix, onError, {
        maximumAge: fresh ? 0 : 5 * 60 * 1000,
        timeout: 10000,
      });

    // index.html may already have a request in flight from before the app
    // loaded; the first non-fresh call uses its answer instead of asking again
    // (null means it didn't ask, so ask now).
    const early = !fresh && window.__earlyLocation;
    if (early) {
      window.__earlyLocation = null;
      early.then((result) => {
        if (!result) request();
        else if (result.position) onFix(result.position);
        else onError(result.error);
      });
      return;
    }
    request();
  };

  return {
    nearbyStops,
    nearbyStopsMap,
    userLocation,
    searchingAddress,
    locating,
    findingLocation,
    searchByAddress,
    findNearbyStops,
    refindNearbyStops,
    clearNearbyStops: () => {
      searchSeq.current++;
      setNearbyStops(null);
    },
  };
}