import styles from "./MapFab.module.css";

// Floating action button styled to sit over a Leaflet map. Position is
// controlled by the parent's flex/absolute layout; this component just
// renders a consistent round 44x44 button with primary-colored icon.
function MapFab({ onClick, ariaLabel, children, disabled }) {
  return (
    <button
      type="button"
      className={styles.fab}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default MapFab;
