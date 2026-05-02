import { useState } from "react";
import { API_BASE } from "../constants";

export function useNearbyStops(setError, searchRadius = 0.25) {
  const [nearbyStops, setNearbyStops] = useState(null);
  const [nearbyStopsMap, setNearbyStopsMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [locating, setLocating] = useState(false);        // add this

  const searchByAddress = async (query) => {
    setSearchingAddress(true);
    setError(null);
    setNearbyStops(null);
    try {
      const res = await fetch(`${API_BASE}/api/search-stops?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setNearbyStops(data.stops);
    } catch (_err) {
      setError("Could not search for stops. Try again.");
    } finally {
      setSearchingAddress(false);
    }
  };

  const findNearbyStops = () => {
    if (locating || userLocation) return;
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

        try {
          const res = await fetch(`${API_BASE}/api/nearby-stops-by-coords?lat=${lat}&lon=${lon}&radius=${searchRadius}`);
          const data = await res.json();
          if (data.stops) {
            setNearbyStopsMap(data.stops);
            setError(null);       // clear any stale error on success
          }
        } catch (_err) {
          setError("Could not find nearby stops.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("Could not get your location. Please allow location access.");
      }
    );
  };

  const refindNearbyStops = async (lat, lon, radius) => {
    try {
      const res = await fetch(`${API_BASE}/api/nearby-stops-by-coords?lat=${lat}&lon=${lon}&radius=${radius}`);
      console.log("refindNearbyStops called", lat, lon, radius);
      const data = await res.json();
      if (data.stops) {
        setNearbyStopsMap(data.stops);
        setError(null);
      }
    } catch (_err) {
      setError("Could not find nearby stops.");
    }
  };

  return {
  nearbyStops,
  nearbyStopsMap,
  userLocation,
  searchingAddress,
  locating,
  searchByAddress,
  findNearbyStops,
  refindNearbyStops,
  clearNearbyStops: () => setNearbyStops(null),
};
}