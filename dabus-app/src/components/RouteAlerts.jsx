import styles from "./RouteAlerts.module.css";

// Renders a stack of service-alert pills with an external-link target and a
// dismiss button. Pass in an already-filtered `alerts` array — this component
// does not deduplicate or filter by route itself.
function RouteAlerts({ alerts, onDismiss, compact = false }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className={compact ? styles.containerCompact : styles.container}>
      {alerts.map((alert) => (
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
    </div>
  );
}

export default RouteAlerts;
