import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE } from "../constants";

// 5 minutes — matches the backend cache TTL, so we're not refetching faster than
// the server actually re-scrapes upstream.
const REFRESH_MS = 5 * 60 * 1000;

const DISMISSED_KEY = "dabus-dismissed-alerts";

const readDismissed = () => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

const writeDismissed = (set) => {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage may be unavailable (Safari private mode, etc.) — ignore
  }
};

// Builds key -> alerts indexes. Routes are keyed by route_short_name; stops by
// the displayed stop code (community posts carry `affected_stops`; scraped OTS
// alerts don't, so they only ever appear in the route index).
const indexBy = (field) => (list) => {
  const map = new Map();
  for (const alert of list) {
    for (const key of alert[field] || []) {
      const k = String(key);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(alert);
    }
  }
  return map;
};
const indexByRoute = indexBy("affected_routes");
const indexByStop = indexBy("affected_stops");

// Fetches and exposes service alerts. Dismissed IDs persist in localStorage so a
// user who dismisses an alert won't see it again until OTS rotates to a new ID.
export function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(() => readDismissed());

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      setStale(Boolean(data.stale));
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const dismiss = useCallback((alertId) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      writeDismissed(next);
      return next;
    });
  }, []);

  const clearDismissed = useCallback(() => {
    setDismissed(new Set());
    writeDismissed(new Set());
  }, []);

  // Un-dismiss a specific list of alert IDs (or undefined to restore everything).
  // Used by the "Show N hidden alerts" link so consumers can restore only the
  // alerts that affect the current view, not every dismissed alert globally.
  const restore = useCallback((alertIds) => {
    setDismissed((prev) => {
      if (!alertIds) {
        writeDismissed(new Set());
        return new Set();
      }
      const next = new Set(prev);
      for (const id of alertIds) next.delete(id);
      writeDismissed(next);
      return next;
    });
  }, []);

  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !dismissed.has(a.id)),
    [alerts, dismissed],
  );

  const dismissedAlerts = useMemo(
    () => alerts.filter((a) => dismissed.has(a.id)),
    [alerts, dismissed],
  );

  const alertsByRoute = useMemo(() => indexByRoute(visibleAlerts), [visibleAlerts]);
  const dismissedByRoute = useMemo(() => indexByRoute(dismissedAlerts), [dismissedAlerts]);
  const alertsByStop = useMemo(() => indexByStop(visibleAlerts), [visibleAlerts]);
  const dismissedByStop = useMemo(() => indexByStop(dismissedAlerts), [dismissedAlerts]);

  const alertsForRoute = useCallback(
    (routeShortName) => alertsByRoute.get(routeShortName) || [],
    [alertsByRoute],
  );

  const dismissedAlertsForRoute = useCallback(
    (routeShortName) => dismissedByRoute.get(routeShortName) || [],
    [dismissedByRoute],
  );

  const alertsForStop = useCallback(
    (stopId) => (stopId == null ? [] : alertsByStop.get(String(stopId)) || []),
    [alertsByStop],
  );

  const dismissedAlertsForStop = useCallback(
    (stopId) => (stopId == null ? [] : dismissedByStop.get(String(stopId)) || []),
    [dismissedByStop],
  );

  return {
    alerts,
    visibleAlerts,
    dismissedAlerts,
    alertsForRoute,
    dismissedAlertsForRoute,
    alertsForStop,
    dismissedAlertsForStop,
    loading,
    error,
    stale,
    dismiss,
    restore,
    clearDismissed,
    refresh: fetchAlerts,
  };
}
