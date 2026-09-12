import { useEffect, useState } from "react";

import ImageCarousel from "./ImageCarousel";
import styles from "./AnnouncementsTab.module.css";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "service_change", label: "Service" },
  { key: "event", label: "Events" },
  { key: "volunteer", label: "Volunteer" },
  { key: "otr_update", label: "OTR" },
];

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// Splits body text on blank lines so editors can write paragraphs without
// any markup. Single newlines inside a paragraph become <br>.
const Paragraphs = ({ text }) =>
  text
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p, i) => (
      <p key={i}>
        {p.split("\n").map((line, j, arr) => (
          <span key={j}>
            {line}
            {j < arr.length - 1 && <br />}
          </span>
        ))}
      </p>
    ));

function PostCard({ post, onSelectRoute }) {
  const hasImages = post.images && post.images.length > 0;
  const routes = post.route_ids || [];
  return (
    <article className={`${styles.card} ${post.pinned ? styles.pinned : ""}`}>
      {hasImages && <ImageCarousel images={post.images} alt={post.title} />}
      <div className={styles.cardBody}>
        <div className={styles.meta}>
          <span className={`${styles.tag} ${styles[`tag_${post.category}`] || ""}`}>
            {post.category_label}
          </span>
          {post.pinned && <span className={styles.pinnedTag}>Pinned</span>}
          <span className={styles.date}>{formatDate(post.starts_at)}</span>
        </div>
        <h3 className={styles.title}>{post.title}</h3>
        {post.body && (
          <div className={styles.body}>
            <Paragraphs text={post.body} />
          </div>
        )}
        {routes.length > 0 && (
          <div className={styles.routes}>
            <span className={styles.routesLabel}>Routes</span>
            {routes.map((r) => (
              <button
                key={r}
                type="button"
                className={styles.routeChip}
                onClick={() => onSelectRoute?.(r)}
                title={`Open route ${r}`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            More info ↗
          </a>
        )}
      </div>
    </article>
  );
}

// The Announcements tab: a filterable feed of editor-authored posts
// (service changes, events, volunteer asks, OTR updates). Data comes from
// useAnnouncements; this component is purely presentational.
function AnnouncementsTab({ posts, loading, error, configured, onShown, onSelectRoute }) {
  const [filter, setFilter] = useState("all");

  // Clear the unread dot as soon as the tab is on screen.
  useEffect(() => {
    onShown?.();
  }, [onShown, posts]);

  const visible = filter === "all" ? posts : posts.filter((p) => p.category === filter);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Announcements</h2>
      </div>

      <div className={styles.filters} role="tablist" aria-label="Filter announcements">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`${styles.filter} ${filter === f.key ? styles.filterActive : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && posts.length === 0 && <p className={styles.empty}>Loading…</p>}

      {!loading && !configured && (
        <p className={styles.empty}>Announcements aren't set up yet.</p>
      )}

      {!loading && error && posts.length === 0 && configured && (
        <p className={styles.empty} role="alert">
          Couldn't load announcements. Pull to refresh or try again later.
        </p>
      )}

      {!loading && configured && !error && visible.length === 0 && (
        <p className={styles.empty}>
          {filter === "all" ? "Nothing posted yet. Check back soon." : "No posts in this category."}
        </p>
      )}

      <div className={styles.feed}>
        {visible.map((post) => (
          <PostCard key={post.id} post={post} onSelectRoute={onSelectRoute} />
        ))}
      </div>
    </div>
  );
}

export default AnnouncementsTab;
