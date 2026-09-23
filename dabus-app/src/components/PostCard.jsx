import { useLayoutEffect, useRef, useState } from "react";

import ImageCarousel from "./ImageCarousel";
import { categoryLabel, postedLabel, untilLabel } from "../lib/posts";
import styles from "./PostCard.module.css";

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

// One post as riders see it. Shared by the News tab and the /admin preview so
// editors see exactly what will be published.
//
// Long bodies are clamped to a few lines with a "Show more" toggle so one
// long post doesn't push everything else off the screen.
function PostCard({ post, onSelectRoute, onSelectStop, preview = false }) {
  const bodyRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const images = post.images || [];
  const routes = post.route_ids || [];
  const stops = post.stop_ids || [];
  const label = post.category_label || categoryLabel(post.category);
  const until = untilLabel(post.ends_at);

  // Measure whether the clamped body is actually cut off; only then offer
  // "Show more". Re-measured when the text changes (live admin preview).
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [post.body, expanded]);

  return (
    <article className={`${styles.card} ${post.pinned ? styles.pinned : ""}`}>
      {images.length > 0 && <ImageCarousel images={images} alt={post.title || "Post photo"} />}
      <div className={styles.cardBody}>
        <div className={styles.meta}>
          <span className={`${styles.tag} ${styles[`tag_${post.category}`] || ""}`}>{label}</span>
          {post.pinned && (
            <span className={styles.pinnedTag}>
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor">
                <path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z" />
              </svg>
              Pinned
            </span>
          )}
          <span className={styles.date}>{postedLabel(post.starts_at)}</span>
        </div>

        <h3 className={styles.title}>{post.title || (preview ? "Your title here" : "")}</h3>

        {until && <p className={styles.until}>{until}</p>}

        {post.body && (
          <>
            <div
              ref={bodyRef}
              className={`${styles.body} ${expanded ? "" : styles.clamped} ${!expanded && overflows ? styles.faded : ""}`}
            >
              <Paragraphs text={post.body} />
            </div>
            {(overflows || expanded) && (
              <button
                type="button"
                className={styles.moreBtn}
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </>
        )}

        {(routes.length > 0 || stops.length > 0) && (
          <dl className={styles.targets}>
            {routes.length > 0 && (
              <div className={styles.targetRow}>
                <dt>{routes.length === 1 ? "Route" : "Routes"}</dt>
                <dd>
                  {routes.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={styles.chip}
                      onClick={() => onSelectRoute?.(r)}
                      disabled={!onSelectRoute}
                      aria-label={`Open route ${r}`}
                    >
                      {r}
                    </button>
                  ))}
                </dd>
              </div>
            )}
            {stops.length > 0 && (
              <div className={styles.targetRow}>
                <dt>{stops.length === 1 ? "Stop" : "Stops"}</dt>
                <dd>
                  {stops.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.chip} ${styles.stopChip}`}
                      onClick={() => onSelectStop?.(s)}
                      disabled={!onSelectStop}
                      aria-label={`Arrivals for stop ${s}`}
                    >
                      {s}
                    </button>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}

        {post.link_url && (
          <a href={post.link_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
            More info ↗
          </a>
        )}
      </div>
    </article>
  );
}

export default PostCard;
