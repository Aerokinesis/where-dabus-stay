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

  // Visible = not dismissed. Consumers can filter further by route.
  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !dismissed.has(a.id)),
    [alerts, dismissed],
  );

  // Index: route_short_name -> array of alerts that mention it. Built once per
  // alerts/dismissed change so per-route lookups stay O(1).
  const alertsByRoute = useMemo(() => {
    const map = new Map();
    for (const alert of visibleAlerts) {
      for (const route of alert.affected_routes || []) {
        if (!map.has(route)) map.set(route, []);
        map.get(route).push(alert);
      }
    }
    return map;
  }, [visibleAlerts]);

  const alertsForRoute = useCallback(
    (routeShortName) => alertsByRoute.get(routeShortName) || [],
    [alertsByRoute],
  );

  return {
    alerts,
    visibleAlerts,
    alertsForRoute,
    loading,
    error,
    stale,
    dismiss,
    clearDismissed,
    refresh: fetchAlerts,
  };
}
