import { categoryLabel, postStatus } from "../lib/posts";
import styles from "./AdminPage.module.css";

// "Sep 22" or "Sep 22, 3:30 PM" — time only when it isn't midnight.
const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (d.getHours() === 0 && d.getMinutes() === 0) return date;
  return `${date}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
};

const range = (p) => `${when(p.starts_at)} → ${p.ends_at ? when(p.ends_at) : "no end"}`;

const SECTIONS = [
  { key: "live", title: "Live", empty: "Nothing is live right now." },
  { key: "scheduled", title: "Scheduled" },
  { key: "ended", title: "Ended", collapsed: true },
];

function PostRow({ post, status, onEdit, onDelete, onEndNow, onTogglePin }) {
  const cover = post.images?.[0]?.url;
  const targets = [
    post.route_ids?.length ? `${post.route_ids.length === 1 ? "Route" : "Routes"} ${post.route_ids.join(", ")}` : "",
    post.stop_ids?.length ? `${post.stop_ids.length === 1 ? "Stop" : "Stops"} ${post.stop_ids.join(", ")}` : "",
  ].filter(Boolean);

  return (
    <li className={`${styles.postRow} ${status === "ended" ? styles.postRowEnded : ""}`}>
      <button type="button" className={styles.postMain} onClick={() => onEdit(post)} aria-label={`Edit “${post.title}”`}>
        <span className={`${styles.postThumb} ${styles[`thumb_${post.category}`] || ""}`} aria-hidden="true">
          {cover ? <img src={cover} alt="" loading="lazy" /> : categoryLabel(post.category).charAt(0)}
          {post.images?.length > 1 && <span className={styles.thumbCount}>{post.images.length}</span>}
        </span>
        <span className={styles.postText}>
          <span className={styles.postMeta}>
            <span className={styles.postCat}>{categoryLabel(post.category)}</span>
            {post.pinned && <span className={styles.pinBadge}>Pinned</span>}
          </span>
          <span className={styles.postTitle}>{post.title}</span>
          <span className={styles.postSub}>
            {[...targets, range(post)].join(" · ")}
          </span>
        </span>
      </button>
      <div className={styles.postActions}>
        <button type="button" onClick={() => onEdit(post)}>
          Edit
        </button>
        <button type="button" onClick={() => onTogglePin(post)}>
          {post.pinned ? "Unpin" : "Pin"}
        </button>
        {status === "live" && (
          <button type="button" onClick={() => onEndNow(post)}>
            End now
          </button>
        )}
        <button type="button" className={styles.danger} onClick={() => onDelete(post)}>
          Delete
        </button>
      </div>
    </li>
  );
}

// All posts, grouped Live / Scheduled / Ended. Ended is collapsed by default —
// it's history, and would otherwise grow forever above nothing useful.
// `now` is when the list was last loaded, so grouping is stable across renders.
export default function PostList({ posts, loading, now, ...actions }) {
  const grouped = { live: [], scheduled: [], ended: [] };
  for (const p of posts) grouped[postStatus(p, now)].push(p);
  // Pinned first, then newest start first (posts arrive in that order already,
  // but re-sort in case a pin toggle changed it locally).
  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.starts_at) - new Date(a.starts_at));
  }
  // Scheduled reads better soonest-first.
  grouped.scheduled.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  if (loading && posts.length === 0) return <p className={styles.empty}>Loading posts…</p>;

  return (
    <div className={styles.sections}>
      {SECTIONS.map((s) => {
        const list = grouped[s.key];
        if (list.length === 0 && !s.empty) return null;
        const body =
          list.length === 0 ? (
            <p className={styles.sectionEmpty}>{s.empty}</p>
          ) : (
            <ul className={styles.postList}>
              {list.map((p) => (
                <PostRow key={p.id} post={p} status={s.key} {...actions} />
              ))}
            </ul>
          );
        const heading = (
          <>
            {s.title} <span className={styles.sectionCount}>{list.length}</span>
          </>
        );
        return s.collapsed ? (
          <details key={s.key} className={styles.listSection}>
            <summary className={styles.listSectionTitle}>{heading}</summary>
            {body}
          </details>
        ) : (
          <section key={s.key} className={styles.listSection}>
            <h3 className={styles.listSectionTitle}>{heading}</h3>
            {body}
          </section>
        );
      })}
    </div>
  );
}
