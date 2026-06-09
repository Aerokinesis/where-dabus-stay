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

  const safeArrivals = arrivals || [];

  const routesByDirection = safeArrivals.reduce((acc, bus) => {
    if (!bus.direction) return acc;
    if (!acc[bus.direction]) acc[bus.direction] = new Set();
    acc[bus.direction].add(bus.route);
    return acc;
  }, {});

  return (
    
    <div className={styles.container}>
      {currentStop && (
        <div className={styles.stopHeader}>
          <div className={styles.stopInfo}>
            <span className={styles.stopName}>{currentStop.name}</span>
            <span className={styles.stopId}>Stop #{currentStop.id}</span>
          </div>
          <button
            className={`${styles.saveBtn} ${isFavorited ? styles.saved : ""}`}
            onClick={() => onSaveStop(isFavorited)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={isFavorited ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: isFavorited ? "#f87171" : "currentColor",
                flexShrink: 0,
              }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {isFavorited ? "Added to Favorites" : "Favorite"}
          </button>
        </div>
      )}

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
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={refreshing ? styles.spinning : ""}
                aria-hidden="true"
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
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

      {safeArrivals.length > 0 && (
        <div className={styles.summary}>
          {Object.entries(routesByDirection).map(([direction, routes]) => (
            <div key={direction} className={styles.summaryRow}>
              <span className={styles.summaryDirection}>{direction}</span>
              <span className={styles.summaryRoutes}>
                {[...routes]
                  .sort((a, b) =>
                    a.localeCompare(b, undefined, { numeric: true }),
                  )
                  .join(" · ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {safeArrivals.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No upcoming buses</p>
          <p className={styles.emptyHint}>
            There are no scheduled arrivals at this stop right now. Service may
            be on a break or finished for the day.
          </p>
        </div>
      )}

      <div className={styles.list}>
        {safeArrivals.map((bus) => (
          <div
            key={bus.id}
            className={`${styles.card} ${bus.canceled === "1" ? styles.canceled : ""}`}
          >
            <div className={styles.cardTop}>
              <div className={styles.routeBadge}>{bus.route}</div>
              <div className={styles.headsign}>
                {bus.canceled === "1" && (
                  <span className={styles.canceledTag}>Canceled</span>
                )}
                {bus.headsign}
              </div>
              <div className={styles.time}>
                {getMinutesUntil(bus.stopTime, bus.date)}
              </div>
            </div>

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
                    {trackingLoading ? (
                      "Loading..."
                    ) : (
                      <>
                        <span aria-hidden="true">●</span> Tracking
                      </>
                    )}
                  </span>
                ) : (
                  <button
                    className={styles.mapBtn}
                    onClick={() => onShowMap(bus)}
                    disabled={trackingLoading}
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
