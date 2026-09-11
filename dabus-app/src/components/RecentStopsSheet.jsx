import { useRef, useEffect } from "react";
import styles from "./RecentStopsSheet.module.css";
import StopHistory from "./StopHistory";

// The full recent-stops list, opened from the "See all N recent stops" row
// in AddressSearch's dropdown now that Recent no longer has its own tab.
// Reuses StopHistory as-is for the list/remove/clear-all behavior — this
// component is just the sheet chrome around it.
function RecentStopsSheet({ stopHistory, onSelectStop, onRemoveStop, onClose }) {
  const modalRef = useRef(null);
  const closeRef = useRef(null);

  // Same focus-trap / Escape-to-close / focus-restore pattern as
  // ConfirmDialog and SaveStopModal.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();

    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = modalRef.current?.querySelectorAll(
        'button, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recent stops"
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={modalRef} className={styles.sheet}>
        <div className={styles.handle} aria-hidden="true" />
        <button ref={closeRef} type="button" className={styles.done} onClick={onClose}>
          Done
        </button>
        <div className={styles.body}>
          <StopHistory
            stopHistory={stopHistory}
            onSelectStop={(stopId) => {
              onSelectStop(stopId);
              onClose();
            }}
            onRemoveStop={onRemoveStop}
          />
        </div>
      </div>
    </div>
  );
}

export default RecentStopsSheet;
