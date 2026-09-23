import { useEffect, useRef, useState } from "react";

import styles from "./ImageCarousel.module.css";

// Horizontal scroll-snap carousel. Native scrolling handles swipe on touch and
// trackpad; arrows (mouse devices only) and dots just call scrollTo.
//
// Each image is shown whole (object-fit: contain) over a blurred, zoomed copy
// of itself, so portrait event flyers and wide photos are never cropped —
// organizers post flyers with the date at the top, and cropping cut it off.
function ImageCarousel({ images, alt, compact = false }) {
  const scrollerRef = useRef(null);
  const [index, setIndex] = useState(0);

  const count = images?.length || 0;

  // Track which slide is showing so dots and the counter follow swipes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || count < 2) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setIndex(Math.max(0, Math.min(count - 1, i)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [count]);

  if (count === 0) return null;

  const goTo = (i) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = ((i % count) + count) % count;
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1);
    }
  };

  const multi = count > 1;

  return (
    <div className={`${styles.carousel} ${compact ? styles.compact : ""}`}>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        tabIndex={multi ? 0 : -1}
        onKeyDown={onKeyDown}
        role={multi ? "group" : undefined}
        aria-roledescription={multi ? "carousel" : undefined}
        aria-label={multi ? `${count} photos` : undefined}
      >
        {images.map((img, i) => (
          <div
            key={img.url || i}
            className={styles.slide}
            style={{ "--slide-bg": `url("${img.url}")` }}
          >
            <img
              src={img.url}
              alt={img.alt || (multi ? `${alt} (photo ${i + 1} of ${count})` : alt)}
              loading={i === 0 ? "eager" : "lazy"}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {multi && (
        <>
          <span className={styles.counter} aria-hidden="true">
            {index + 1}/{count}
          </span>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowLeft}`}
            onClick={() => goTo(index - 1)}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowRight}`}
            onClick={() => goTo(index + 1)}
            aria-label="Next photo"
          >
            ›
          </button>
          <div className={styles.dots} aria-hidden="true">
            {images.map((_, i) => (
              <span key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ""}`} />
            ))}
          </div>
          <span className={styles.srOnly} aria-live="polite">
            Photo {index + 1} of {count}
          </span>
        </>
      )}
    </div>
  );
}

export default ImageCarousel;
