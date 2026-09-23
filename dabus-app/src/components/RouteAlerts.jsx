import { useState } from "react";

import styles from "./RouteAlerts.module.css";

// Renders a stack of service-alert pills with a dismiss button. Pass in an
// already-filtered `alerts` array — this component does not deduplicate or
// filter by route itself.
//
// Alerts that came with a scraped `description` (currently: the
// Updates/ServiceDisruption.asp entries — detours, bus stop closures) expand
// in place when tapped, showing that description instead of sending the user
// to TheBus's website. Alerts with no description (the RiderAlerts_Listing.asp
// entries — holidays, surveys) still open their own page on thebus.org, since
// that's the only place their actual content lives.
//
// Also takes `hiddenAlerts` — alerts the user has previously dismissed that
// apply to the same context. If any are present, a "Show N hidden" link
// appears below; clicking it calls `onRestore` with their IDs.
function RouteAlerts({ alerts, hiddenAlerts, onDismiss, onRestore, compact = false }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const hasVisible = alerts && alerts.length > 0;
  const hiddenCount = hiddenAlerts ? hiddenAlerts.length : 0;

  if (!hasVisible && hiddenCount === 0) return null;

  const handleRestore = () => {
    if (onRestore && hiddenAlerts) {
      onRestore(hiddenAlerts.map((a) => a.id));
    }
  };

  const toggleExpanded = (alertId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      return next;
    });
  };

  return (
    <div className={compact ? styles.containerCompact : styles.container}>
      {hasVisible &&
        alerts.map((alert) => {
          const hasDescription = Boolean(alert.description);
          const isExpanded = hasDescription && expandedIds.has(alert.id);

          return (
            <div key={alert.id} className={styles.alert} role="alert">
              <div className={styles.alertHeader}>
                <div className={styles.alertBody}>
                  <span className={styles.tag}>{alert.category_label}</span>
                  {hasDescription ? (
                    <button
                      type="button"
                      className={styles.titleBtn}
                      onClick={() => toggleExpanded(alert.id)}
                      aria-expanded={isExpanded}
                    >
                      <span className={styles.titleText}>{alert.title}</span>
                      <span
                        className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    </button>
                  ) : alert.url ? (
                    <a
                      href={alert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.title}
                    >
                      {alert.title}
                    </a>
                  ) : (
                    <span className={styles.title}>{alert.title}</span>
                  )}
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
              {/* Sibling of alertHeader, not a child of alertBody's row — so it
                  gets the full card width instead of being squeezed by the
                  dismiss button's reserved column. */}
              {isExpanded && (
                <div className={styles.description}>
                  <p>{alert.description}</p>
                  {/* Community posts (from the app's own editors) carry an
                      optional link of their own; scraped OTS alerts always
                      point back at thebus.org. */}
                  {alert.source === "community" ? (
                    alert.url && (
                      <a
                        href={alert.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.sourceLink}
                      >
                        More info ↗
                      </a>
                    )
                  ) : (
                    <a
                      href={alert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sourceLink}
                    >
                      See all disruptions on thebus.org ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
