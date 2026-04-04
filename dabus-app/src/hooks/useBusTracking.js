import { useState } from "react";

const API_BASE = "http://localhost:3001";

export function useBusTracking(setError) {
  const [selectedBus, setSelectedBus] = useState(null);
  const [busLocation, setBusLocation] = useState(null);
  const [busShape, setBusShape] = useState(null);
  const [tripStops, setTripStops] = useState(null);

  const fetchBusLocation = async (bus) => {
    // Live buses only
    if (bus.estimated !== "1") return;

    // Toggle off if already selected
    if (selectedBus?.id === bus.id) {
      setSelectedBus(null);
      setBusLocation(null);
      setBusShape(null);
      setTripStops(null);
      return;
    }

    setSelectedBus(bus);

    const hasCoords =
      bus.latitude && bus.longitude &&
      bus.latitude !== "0" && bus.longitude !== "0";

    if (!hasCoords) {
      setError("No live location available for this bus.");
      return;
    }

    setBusLocation({
      latitude: bus.latitude,
      longitude: bus.longitude,
      number: bus.vehicle,
      route_short_name: bus.route,
      headsign: bus.headsign,
      adherence: null,
    });

    // Fetch shape and trip stops in parallel — failures are non-fatal
    const [shapeRes, tripRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/shape/${bus.shape}`),
      fetch(`${API_BASE}/api/trip/${bus.trip}/stops`),
    ]);

    if (shapeRes.status === "fulfilled") {
      const data = await shapeRes.value.json();
      if (data.shape) setBusShape(data.shape);
    }

    if (tripRes.status === "fulfilled") {
      const data = await tripRes.value.json();
      if (data.stops) setTripStops(data.stops);
    }
  };

  return { selectedBus, busLocation, busShape, tripStops, fetchBusLocation };
}
