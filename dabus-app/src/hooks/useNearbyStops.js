import { useState } from "react";

const API_BASE = "http://localhost:3001";

export function useNearbyStops(setError) {
  const [nearbyStops, setNearbyStops] = useState(null);
  const [nearbyStopsMap, setNearbyStopsMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [searchingAddress, setSearchingAddress] = useState(false);

  const searchByAddress = async (address) => {
    setSearchingAddress(true);
    setError(null);
    setNearbyStops(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/nearby-stops?address=${encodeURIComponent(address)}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setNearbyStops(data.stops);
      }
    } catch (_err) {
      setError("Could not search for nearby stops. Try again.");
    } finally {
      setSearchingAddress(false);
    }
  };

  const findNearbyStops = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserLocation({ lat, lon });

        try {
          const res = await fetch(
            `${API_BASE}/api/nearby-stops-by-coords?lat=${lat}&lon=${lon}`
          );
          const data = await res.json();
          if (data.stops) setNearbyStopsMap(data.stops);
        } catch (_err) {
          setError("Could not find nearby stops.");
        }
      },
      () => {
        setError("Could not get your location. Please allow location access.");
      }
    );
  };

  return {
    nearbyStops,
    nearbyStopsMap,
    userLocation,
    searchingAddress,
    searchByAddress,
    findNearbyStops,
  };
}
