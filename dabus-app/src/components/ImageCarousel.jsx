import { useEffect, useRef, useState } from "react";

import styles from "./ImageCarousel.module.css";

// Horizontal scroll-snap carousel. No JS-driven animation — native scrolling
// handles swipe on touch and trackpad; the arrow buttons and dots just call
// scrollTo. Keyboard: the scroller is focusable and left/right arrows move it.
function ImageCarousel({ images, alt }) {
  const scrollerRef = useRef(null);
  const [index, setIndex] = useState(0);

  const count = images?.length || 0;

  // Track which slide is centered so the dots stay in sync with swipes.
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

  return (
    <div className={styles.carousel}>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        tabIndex={count > 1 ? 0 : -1}
        onKeyDown={onKeyDown}
        role={count > 1 ? "group" : undefined}
        aria-roledescription={count > 1 ? "carousel" : undefined}
        aria-label={count > 1 ? `${count} images` : undefined}
      >
        {images.map((img, i) => (
          <div key={img.url || i} className={styles.slide}>
            <img
              src={img.url}
              alt={img.alt || (count > 1 ? `${alt} (${i + 1} of ${count})` : alt)}
              loading="lazy"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowLeft}`}
            onClick={() => goTo(index - 1)}
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowRight}`}
            onClick={() => goTo(index + 1)}
            aria-label="Next image"
          >
            ›
          </button>
          <div className={styles.dots} aria-hidden="true">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <span className={styles.srOnly} aria-live="polite">
            Image {index + 1} of {count}
          </span>
        </>
      )}
    </div>
  );
}

export default ImageCarousel;
