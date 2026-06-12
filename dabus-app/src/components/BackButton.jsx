import styles from "../App.module.css";

// The back-arrow button used in every top bar and overlay header.
function BackButton({ onClick, label = "Back" }) {
  return (
    <button className={styles.topBarBack} aria-label={label} onClick={onClick}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
      </svg>
    </button>
  );
}

export default BackButton;
