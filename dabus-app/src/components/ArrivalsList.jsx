import { useState } from "react";
import styles from "./ArrivalsList.module.css";
import RouteAlerts from "./RouteAlerts";

function ArrivalsList({
  arrivals,
  selectedBus,
  trackingLoading,
  onShowMap,
  currentStop,
  isFavorited,
  onSaveStop,
  lastUpdated,
  onRefresh,
  onBack,
  arrivalsTab,
  onBackToTracking,
  routeShortName,
  alerts,
  hiddenAlerts,
  onDismissAlert,
  onRestoreAlerts,
}) {
  const [refreshing, setRefreshing] = useState(false);

  const getMinutesUntil = (stopTime, date) => {
    const now = new Date();
    const arrival = new Date(`${date} ${stopTime}`);
    const diff = Math.round((arrival - now) / 60000);
    if (diff <= 0) return "Now";
    if (diff === 1) return "1 min";
    if (diff < 60) return `${diff} mins`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  };

  const backLabel =
    arrivalsTab === "history" ? "Recent"
    : arrivalsTab === "routes" ? (routeShortName ? `Route ${routeShortName}` : "Stops")
    : arrivalsTab === "nearby" ? "Home"
    : "Favorites";

  const safeArrivals = arrivals || [];

  const routesByDirection = safeArrivals.reduce((acc, bus) => {
    if (!bus.direction) return acc;
    if (!acc[bus.direction]) acc[bus.direction] = new Set();
    acc[bus.direction].add(bus.route);
    return acc;
  }, {});

  return (
    <div className={styles.container}>
      {/* Loading announcer — screen readers are notified when arrivals load */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {safeArrivals.length > 0
          ? `${safeArrivals.length} arrival${safeArrivals.length === 1 ? "" : "s"} loaded`
          : ""}
      </div>

      {/* Back button */}
      {onBack && (
        <button className={styles.backBtn} onClick={onBack}>
          <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
          {backLabel}
        </button>
      )}
      {onBackToTracking && (
        <button className={styles.backBtn} onClick={onBackToTracking}>
          <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
          Back to tracking
        </button>
      )}

      {/* Stop header */}
      {currentStop && (
        <div className={styles.stopHeader}>
          <div className={styles.stopInfo}>
            <span className={styles.stopName}>{currentStop.name}</span>
            <span className={styles.stopId}>Stop #{currentStop.id}</span>
          </div>
          <button
            className={`${styles.favoriteChip} ${isFavorited ? styles.favoriteChipActive : ""}`}
            onClick={() => onSaveStop(isFavorited)}
            aria-pressed={isFavorited}
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <span className="material-symbols-rounded" aria-hidden="true">favorite</span>
            {isFavorited ? "Favorited" : "Favorite"}
          </button>
        </div>
      )}

      {/* Last updated row */}
      {lastUpdated && (
        <div className={styles.lastUpdatedRow}>
          <span className={styles.lastUpdated}>
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
          {onRefresh && (
            <button
              className={styles.refreshBtn}
              aria-label="Refresh arrivals"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                await onRefresh();
                setRefreshing(false);
              }}
            >
              <span
                className={`material-symbols-rounded ${refreshing ? styles.spinning : ""}`}
              >
                refresh
              </span>
            </button>
          )}
        </div>
      )}

      <RouteAlerts
        alerts={alerts}
        hiddenAlerts={hiddenAlerts}
        onDismiss={onDismissAlert}
        onRestore={onRestoreAlerts}
      />

      {/* Direction summary */}
      {safeArrivals.length > 0 && (
        <div className={styles.summary}>
          {Object.entries(routesByDirection).map(([direction, routes]) => (
            <div key={direction} className={styles.summaryRow}>
              <span className={styles.summaryDirection}>{direction}</span>
              <span className={styles.summaryRoutes}>
                {[...routes]
                  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                  .join(" · ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {safeArrivals.length === 0 && (
        <div className={styles.emptyCard}>
          <span className={`material-symbols-rounded ${styles.emptyIcon}`}>
            directions_bus
          </span>
          <p className={styles.emptyTitle}>No upcoming buses</p>
          <p className={styles.emptyHint}>
            There are no scheduled arrivals at this stop right now. Service may
            be on a break or finished for the day.
          </p>
        </div>
      )}

      {/* Arrival cards */}
      <div className={styles.list}>
        {safeArrivals.map((bus) => (
          <div
            key={bus.id}
            className={`${styles.card} ${bus.canceled === "1" ? styles.canceled : ""}`}
          >
            {/* Top row: route badge · headsign · countdown */}
            <div className={styles.cardTop}>
              <span className={styles.routeBadge}>{bus.route}</span>
              <span className={styles.headsign}>
                {bus.canceled === "1" && (
                  <span className={styles.canceledTag}>Canceled</span>
                )}
                {bus.headsign}
              </span>
              <span className={styles.time}>
                {getMinutesUntil(bus.stopTime, bus.date)}
              </span>
            </div>

            <hr className={styles.divider} />

            {/* Bottom row: live/scheduled · time · vehicle · track */}
            <div className={styles.cardBottom}>
              <span
                className={`${styles.liveTag} ${bus.estimated === "1" ? styles.live : styles.scheduled}`}
              >
                {bus.estimated === "1" ? "● Live" : "○ Scheduled"}
              </span>
              <span className={styles.scheduledTime}>{bus.stopTime}</span>
              {bus.estimated === "1" && (
                <span className={styles.vehicle}>Bus #{bus.vehicle}</span>
              )}
              {bus.estimated === "1" && (
                selectedBus?.id === bus.id ? (
                  <span className={styles.trackingPill}>
                    {trackingLoading
                      ? <span className={`material-symbols-rounded ${styles.spinning}`} style={{ fontSize: "16px" }}>refresh</span>
                      : <><span aria-hidden="true">●</span> Tracking</>
                    }
                  </span>
                ) : (
                  <button
                    className={styles.trackBtn}
                    onClick={() => onShowMap(bus)}
                    disabled={trackingLoading}
                    aria-label={`Track route ${bus.route} to ${bus.headsign}`}
                  >
                    Track
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ArrivalsList;
