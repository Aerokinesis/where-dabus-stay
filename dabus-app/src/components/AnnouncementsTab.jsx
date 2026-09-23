import { useEffect, useState } from "react";

import PostCard from "./PostCard";
import { CATEGORIES } from "../lib/posts";
import styles from "./AnnouncementsTab.module.css";

const FILTERS = [{ key: "all", label: "All" }, ...CATEGORIES.map((c) => ({ key: c.key, label: c.filter }))];

// The News tab: a filterable feed of editor-authored posts (service changes,
// events, volunteer asks, OTR updates). Data comes from useAnnouncements.
function AnnouncementsTab({ posts, loading, error, configured, onShown, onSelectRoute, onSelectStop, onRetry }) {
  const [filter, setFilter] = useState("all");

  // Clear the unread dot as soon as the tab is on screen.
  useEffect(() => {
    onShown?.();
  }, [onShown, posts]);

  const visible = filter === "all" ? posts : posts.filter((p) => p.category === filter);
  // Hide filters for categories with nothing in them, so riders never tap
  // into an empty list. "All" always stays.
  const present = new Set(posts.map((p) => p.category));
  const filters = FILTERS.filter((f) => f.key === "all" || present.has(f.key));
  const showFilters = filters.length > 2;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>News</h2>

      {showFilters && (
        <div className={styles.filters} role="group" aria-label="Filter posts">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              className={`${styles.filter} ${filter === f.key ? styles.filterActive : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading && posts.length === 0 && (
        <div className={styles.feed} aria-busy="true" aria-label="Loading news">
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      )}

      {!loading && !configured && <p className={styles.empty}>News isn't set up yet.</p>}

      {!loading && configured && error && posts.length === 0 && (
        <div className={styles.empty} role="alert">
          <p>Couldn't load news right now.</p>
          {onRetry && (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}

      {!loading && configured && !error && visible.length === 0 && (
        <p className={styles.empty}>
          {filter === "all" ? "Nothing posted yet. Check back soon." : "No posts in this category right now."}
        </p>
      )}

      {visible.length > 0 && (
        <div className={styles.feed}>
          {visible.map((post) => (
            <PostCard key={post.id} post={post} onSelectRoute={onSelectRoute} onSelectStop={onSelectStop} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AnnouncementsTab;
