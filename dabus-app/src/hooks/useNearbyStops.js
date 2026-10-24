import { useState, useCallback } from "react";
import { API_BASE } from "../constants";

// The last location fix, kept on the device so the Nearby map can open where
// the user was last time while a new fix is found.
const LAST_LOCATION_KEY = "dabus-last-location";
const STALE_FIX_MS = 60 * 1000;

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

export function useNearbyStops(setError, searchRadius = 0.25) {
  const [nearbyStops, setNearbyStops] = useState(null);
  const [nearbyStopsMap, setNearbyStopsMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  // True only while waiting on a GPS fix the user can see is pending (not the
  // stops fetch after it, and not a quiet follow-up), for the map's indicator.
  const [findingLocation, setFindingLocation] = useState(false);

  const searchByAddress = async (query) => {
    setSearchingAddress(true);
    setError(null);
    setNearbyStops(null);
    try {
      const res = await fetch(`${API_BASE}/api/search-stops?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setNearbyStops(data.stops);
    } catch {
      setError("Could not search for stops. Try again.");
    } finally {
      setSearchingAddress(false);
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
  const findNearbyStops = ({ recenter = true, fresh = false, quiet = false } = {}) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    if (!quiet) setFindingLocation(true);
    const onFix = async (position) => {
      setFindingLocation(false);
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      setUserLocation({ lat, lon, recenter });
      saveLastLocation(lat, lon);
      const stale = !fresh && Date.now() - position.timestamp > STALE_FIX_MS;
      if (stale) findNearbyStops({ recenter, fresh: true, quiet: true });
      await refindNearbyStops(lat, lon, searchRadius);
      if (!stale) setLocating(false);
    };
    const onError = (err) => {
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

    // index.html may already have a request in flight from before the app
    // loaded; the first non-fresh call uses its answer instead of asking again.
    const early = !fresh && window.__earlyLocation;
    if (early) {
      window.__earlyLocation = null;
      early.then(({ position, error }) => (position ? onFix(position) : onError(error)));
      return;
    }
    navigator.geolocation.getCurrentPosition(onFix, onError, {
      maximumAge: fresh ? 0 : 5 * 60 * 1000,
      timeout: 10000,
    });
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
    clearNearbyStops: () => setNearbyStops(null),
  };
}