import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE } from "../constants";

// Matches the server-side cache TTL (announcements.js) — no point polling faster.
const REFRESH_MS = 60 * 1000;

const LAST_SEEN_KEY = "dabus-announcements-seen";

const readLastSeen = () => {
  try {
    return localStorage.getItem(LAST_SEEN_KEY) || "";
  } catch {
    return "";
  }
};

// Community announcements feed (Supabase posts proxied through /api/announcements).
// `unreadCount` drives the dot on the nav icon: posts newer than the last time
// the user opened the tab. Call `markSeen()` when the tab is shown.
export function useAnnouncements() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [lastSeen, setLastSeen] = useState(() => readLastSeen());

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/announcements`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setConfigured(data.configured !== false);
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    const id = setInterval(fetchPosts, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchPosts]);

  const unreadCount = useMemo(
    () => posts.filter((p) => !lastSeen || p.created_at > lastSeen).length,
    [posts, lastSeen],
  );

  const markSeen = useCallback(() => {
    const newest = posts.reduce((max, p) => (p.created_at > max ? p.created_at : max), "");
    if (!newest || newest === lastSeen) return;
    setLastSeen(newest);
    try {
      localStorage.setItem(LAST_SEEN_KEY, newest);
    } catch {
      // localStorage unavailable — dot just persists this session
    }
  }, [posts, lastSeen]);

  return { posts, loading, error, configured, unreadCount, markSeen, refresh: fetchPosts };
}
