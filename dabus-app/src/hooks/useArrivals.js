import { useState, useEffect, useCallback, useRef } from "react";

import { API_BASE } from "../constants";

export function formatStopName(raw, stopId) {
  return raw
    ? raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : `Stop #${stopId}`;
}

// How long a bus that just dropped out of the live feed lingers labeled
// "Arrived" before it's removed — long enough to confirm the bus came,
// short enough to stay out of the way.
const ARRIVED_LINGER_MS = 1 * 60 * 1000;
// A vanished bus is only treated as "Arrived" if its predicted time was within
// this window of now when it disappeared. Outside the window it's almost
// certainly a GPS dropout or a stale row, not a real arrival.
const ARRIVED_DUE_AHEAD_MS = 2 * 60 * 1000; // due within the next 2 min
const ARRIVED_DUE_BEHIND_MS = 5 * 60 * 1000; // ...through 5 min past

export function useArrivals() {
  const [arrivals, setArrivals] = useState(null);
  const [currentStop, setCurrentStop] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Retention across refreshes so we can keep showing a bus as "Arrived" for a
  // short while after the upstream feed drops it (the feed removes a bus the
  // instant it arrives). All of this is per-stop.
  const prevFeedRef = useRef([]); // raw feed arrivals from the previous fetch
  const arrivedRef = useRef([]); // [{ ...bus, arrived: true, arrivedAt }]
  const lastStopRef = useRef(null);

  const resetRetention = useCallback(() => {
    prevFeedRef.current = [];
    arrivedRef.current = [];
    lastStopRef.current = null;
  }, []);

  const fetchArrivals = useCallback(
    async (stopId) => {
      if (!stopId) return;
      setLoading(true);
      setError(null);

      try {
        const [arrivalsRes, stopRes] = await Promise.all([
          fetch(`${API_BASE}/api/arrivals?stop=${stopId}`),
          fetch(`${API_BASE}/api/stop/${stopId}`),
        ]);

        // 404 (or any non-OK) from /api/stop/:stopId means the stop isn't real
        if (!stopRes.ok) {
          setError(
            `Stop #${stopId} doesn't exist. Check the number and try again.`,
          );
          setArrivals(null);
          setCurrentStop(null);
          resetRetention();
          return null;
        }

        // The stop is real but the times couldn't be fetched (TheBus refused
        // the request, or was unreachable). Say so, rather than letting an
        // empty list read as "No upcoming buses". On a refresh of the same
        // stop, its last good times stay up under the message; a different
        // stop's times are cleared so they can't be mistaken for this one's.
        if (!arrivalsRes.ok) {
          setError("Couldn't load arrival times right now. Try again in a moment.");
          if (lastStopRef.current !== stopId) {
            setArrivals(null);
            setCurrentStop(null);
            resetRetention();
          }
          return null;
        }

        const arrivalsData = await arrivalsRes.json();
        const stopData = await stopRes.json();
        const stopName = formatStopName(stopData.stop_name, stopId);

        const newFeed = arrivalsData.arrivals || [];
        const now = Date.now();

        // New stop selected — start retention fresh.
        if (lastStopRef.current !== stopId) {
          prevFeedRef.current = [];
          arrivedRef.current = [];
          lastStopRef.current = stopId;
        }

        const newIds = new Set(newFeed.map((b) => b.id));
        const dueMs = (b) => {
          const t = new Date(`${b.date} ${b.stopTime}`).getTime();
          return Number.isNaN(t) ? null : t;
        };

        // A bus present last refresh but gone now counts as "Arrived" only if
        // it had live GPS and was due right around now — guards against GPS
        // dropouts (still far out) and stale rows being mislabeled.
        for (const b of prevFeedRef.current) {
          if (newIds.has(b.id)) continue;
          if (b.estimated !== "1") continue;
          const t = dueMs(b);
          if (t === null) continue;
          if (t > now + ARRIVED_DUE_AHEAD_MS) continue;
          if (t < now - ARRIVED_DUE_BEHIND_MS) continue;
          if (!arrivedRef.current.some((a) => a.id === b.id)) {
            arrivedRef.current.push({ ...b, arrived: true, arrivedAt: now });
          }
        }

        // Drop arrived entries that reappeared in the feed (GPS came back) or
        // that have lingered past their window.
        arrivedRef.current = arrivedRef.current.filter(
          (a) => !newIds.has(a.id) && now - a.arrivedAt < ARRIVED_LINGER_MS,
        );

        prevFeedRef.current = newFeed;

        // Arrived buses first (most recent at the top), like the old app.
        setArrivals([...arrivedRef.current, ...newFeed]);
        setCurrentStop({ id: stopId, name: stopName });
        setLastUpdated(new Date());

        return stopName;
      } catch {
        setError(
          "Could not fetch arrivals. Check your stop number and try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [resetRetention],
  );

  // Auto-refresh every 30 seconds while a stop is selected
  useEffect(() => {
    if (!currentStop) return;
    const interval = setInterval(() => fetchArrivals(currentStop.id), 30000);
    return () => clearInterval(interval);
  }, [currentStop, fetchArrivals]);

  const clearArrivals = () => {
    setArrivals(null);
    setCurrentStop(null);
    resetRetention();
  };

  return {
    arrivals,
    currentStop,
    loading,
    error,
    setError,
    fetchArrivals,
    lastUpdated,
    clearArrivals,
  };
}
