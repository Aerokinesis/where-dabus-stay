import { useState, useEffect } from "react";

import { API_BASE } from "../constants";

export function useBusTracking(setError) {
  const [selectedBus, setSelectedBus] = useState(null);
  const [busLocation, setBusLocation] = useState(null);
  const [busShape, setBusShape] = useState(null);
  const [tripStops, setTripStops] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Schedule adherence for the tracked bus (from /api/vehicle, which wraps
  // TheBus's vehicle API). Merged into busLocation only if that bus is still
  // the one being tracked when the response lands.
  const loadVehicleStatus = async (number) => {
    try {
      const res = await fetch(`${API_BASE}/api/vehicle/${number}`);
      if (!res.ok) return;
      const data = await res.json();
      setBusLocation((current) =>
        current && current.number === number
          ? { ...current, adherence: data.adherence, adherenceAgeS: data.last_message_age_s }
          : current,
      );
    } catch {
      // No badge this round; the next refresh tries again.
    }
  };

  // Keep the badge current while tracking stays open, on the same 30 s
  // cadence as the arrivals list.
  const trackedNumber = selectedBus?.vehicle;
  useEffect(() => {
    if (!trackedNumber) return;
    const id = setInterval(() => loadVehicleStatus(trackedNumber), 30000);
    return () => clearInterval(id);
  }, [trackedNumber]);

  const fetchBusLocation = async (bus) => {
    if (bus.estimated !== "1") return;

    // If the same bus is re-tracked (or a different one), clear any prior shape/stops
    // so we don't briefly render stale overlays while the new fetch is in flight.
    setBusShape(null);
    setTripStops(null);
    setSelectedBus(bus);
    setTrackingLoading(true);

    const hasCoords =
      bus.latitude && bus.longitude &&
      bus.latitude !== "0" && bus.longitude !== "0";

    if (!hasCoords) {
      setError("No live location available for this bus.");
      setTrackingLoading(false);
      return;
    }

    setBusLocation({
      latitude: bus.latitude,
      longitude: bus.longitude,
      number: bus.vehicle,
      route_short_name: bus.route,
      headsign: bus.headsign,
      adherence: null,
      adherenceAgeS: null,
    });
    loadVehicleStatus(bus.vehicle);

    const [shapeRes, tripRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/shape/${bus.shape}`),
      fetch(`${API_BASE}/api/trip/${bus.trip}/stops?shape=${bus.shape}`),
    ]);

    if (shapeRes.status === "fulfilled") {
      const data = await shapeRes.value.json();
      if (data.shape) setBusShape(data.shape);
    }

    if (tripRes.status === "fulfilled") {
      const data = await tripRes.value.json();
      if (data.stops) setTripStops(data.stops);
    }

    setTrackingLoading(false);
  };

  const clearBusTracking = () => {
    setSelectedBus(null);
    setBusLocation(null);
    setBusShape(null);
    setTripStops(null);
    setTrackingLoading(false);
  };

  return { selectedBus, busLocation, busShape, tripStops, trackingLoading, fetchBusLocation, clearBusTracking };
}