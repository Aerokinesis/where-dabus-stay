import styles from "./InstallBanner.module.css";

/**
 * Auto-surfacing install prompt. Android/desktop get a real Install button
 * wired to the captured beforeinstallprompt event; iOS Safari gets Add to
 * Home Screen instructions; iOS Chrome/Firefox are told to switch to Safari,
 * because Apple does not allow those browsers to install anything.
 *
 * Visibility is decided by usePwaInstall — this component only renders.
 */
function InstallBanner({ platform, onInstall, onDismiss }) {
  return (
    <div className={styles.banner} role="region" aria-label="Install app">
      <button
        className={styles.close}
        onClick={onDismiss}
        aria-label="Dismiss install prompt"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <img src="/dabus-icon-128.png" alt="" className={styles.icon} />

      <div className={styles.body}>
        {platform === "other" && (
          <>
            <p className={styles.title}>Install Where Da Bus Stay?</p>
            <p className={styles.sub}>
              Quick access from your home screen, and your saved stops work
              offline.
            </p>
            <button className={styles.installBtn} onClick={onInstall}>
              Install
            </button>
          </>
        )}

        {platform === "ios-safari" && (
          <>
            <p className={styles.title}>Add to Home Screen</p>
            <p className={styles.sub}>
              Tap <ShareIcon /> in the Safari toolbar, then{" "}
              <strong>Add to Home Screen</strong>.
            </p>
          </>
        )}

        {platform === "ios-other" && (
          <>
            <p className={styles.title}>Add to Home Screen</p>
            <p className={styles.sub}>
              On iPhone this only works in <strong>Safari</strong>. Open this
              page in Safari, tap <ShareIcon />, then{" "}
              <strong>Add to Home Screen</strong>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline", verticalAlign: "middle" }}
      aria-label="Share"
      role="img"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export default InstallBanner;
