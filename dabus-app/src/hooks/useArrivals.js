import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3001";

function formatStopName(raw, stopId) {
  return raw
    ? raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : `Stop #${stopId}`;
}

export function useArrivals() {
  const [arrivals, setArrivals] = useState(null);
  const [currentStop, setCurrentStop] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchArrivals = useCallback(async (stopId) => {
    if (!stopId) return;
    setLoading(true);
    setError(null);

    try {
      const [arrivalsRes, stopRes] = await Promise.all([
        fetch(`${API_BASE}/api/arrivals?stop=${stopId}`),
        fetch(`${API_BASE}/api/stop/${stopId}`),
      ]);

      const arrivalsData = await arrivalsRes.json();
      const stopData = await stopRes.json();

      setArrivals(arrivalsData.arrivals);
      setCurrentStop({
        id: stopId,
        name: formatStopName(stopData.stop_name, stopId),
      });
      setLastUpdated(new Date());
    } catch (_err) {
      setError("Could not fetch arrivals. Check your stop number and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds while a stop is selected
  useEffect(() => {
    if (!currentStop) return;
    const interval = setInterval(() => fetchArrivals(currentStop.id), 30000);
    return () => clearInterval(interval);
  }, [currentStop, fetchArrivals]);

  return { arrivals, currentStop, loading, error, setError, fetchArrivals, lastUpdated };
}
