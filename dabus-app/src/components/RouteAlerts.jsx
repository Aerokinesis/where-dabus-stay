import styles from "./RouteAlerts.module.css";

// Renders a stack of service-alert pills with an external-link target and a
// dismiss button. Pass in an already-filtered `alerts` array — this component
// does not deduplicate or filter by route itself.
//
// Also takes `hiddenAlerts` — alerts the user has previously dismissed that
// apply to the same context. If any are present, a "Show N hidden" link
// appears below; clicking it calls `onRestore` with their IDs.
function RouteAlerts({ alerts, hiddenAlerts, onDismiss, onRestore, compact = false }) {
  const hasVisible = alerts && alerts.length > 0;
  const hiddenCount = hiddenAlerts ? hiddenAlerts.length : 0;

  if (!hasVisible && hiddenCount === 0) return null;

  const handleRestore = () => {
    if (onRestore && hiddenAlerts) {
      onRestore(hiddenAlerts.map((a) => a.id));
    }
  };

  return (
    <div className={compact ? styles.containerCompact : styles.container}>
      {hasVisible &&
        alerts.map((alert) => (
          <div key={alert.id} className={styles.alert} role="alert">
            <div className={styles.alertBody}>
              <span className={styles.tag}>{alert.category_label}</span>
              <a
                href={alert.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.title}
              >
                {alert.title}
              </a>
            </div>
            {onDismiss && (
              <button
                type="button"
                className={styles.dismiss}
                onClick={() => onDismiss(alert.id)}
                aria-label={`Dismiss alert: ${alert.title}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      {hiddenCount > 0 && onRestore && (
        <button
          type="button"
          className={styles.showHidden}
          onClick={handleRestore}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Show {hiddenCount} hidden alert{hiddenCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

export default RouteAlerts;
