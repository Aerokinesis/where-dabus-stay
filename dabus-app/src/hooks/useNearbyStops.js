import { useState, useCallback } from "react";
import { API_BASE } from "../constants";

// Oahu bounding box — any GPS fix outside this is not on the island
const OAHU_BOUNDS = { minLat: 21.2, maxLat: 21.75, minLon: -158.35, maxLon: -157.6 }
const isOnOahu = (lat, lon) =>
  lat >= OAHU_BOUNDS.minLat && lat <= OAHU_BOUNDS.maxLat &&
  lon >= OAHU_BOUNDS.minLon && lon <= OAHU_BOUNDS.maxLon

export function useNearbyStops(setError, searchRadius = 0.25) {
  const [nearbyStops, setNearbyStops] = useState(null);
  const [nearbyStopsMap, setNearbyStopsMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [offIsland, setOffIsland] = useState(false);

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

  const findNearbyStops = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserLocation({ lat, lon });
        if (!isOnOahu(lat, lon)) {
          setOffIsland(true);
          setLocating(false);
          return;
        }
        setOffIsland(false);
        await refindNearbyStops(lat, lon, searchRadius);
        setLocating(false);
      },
      () => {
        setError("Could not get your location. Please allow location access.");
        setLocating(false);
      },
      { maximumAge: 60000, timeout: 10000 }
    );
  };

  return {
    nearbyStops,
    nearbyStopsMap,
    userLocation,
    searchingAddress,
    locating,
    offIsland,
    searchByAddress,
    findNearbyStops,
    refindNearbyStops,
    clearNearbyStops: () => setNearbyStops(null),
  };
}