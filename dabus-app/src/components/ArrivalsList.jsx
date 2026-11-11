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
  alerts,
  hiddenAlerts,
  onDismissAlert,
  onRestoreAlerts,
  view = "list",
  onChangeView,
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

  // Compact form of getMinutesUntil for the grouped tiles: a big value and
  // a small unit under it.
  const getTileTime = (stopTime, date) => {
    const diff = Math.round((new Date(`${date} ${stopTime}`) - new Date()) / 60000);
    if (diff <= 0) return { value: "Now", unit: "" };
    if (diff < 60) return { value: diff, unit: diff === 1 ? "minute" : "minutes" };
    const mins = diff % 60;
    return { value: `${Math.floor(diff / 60)}h${mins ? ` ${mins}m` : ""}`, unit: "" };
  };

  const getStatus = (bus) => {
    const isArrived = bus.arrived === true;
    const isLive = bus.estimated === "1";
    // TheBus sometimes leaves the canceled flag set on a block that a
    // vehicle is still running. Live GPS means a bus really is coming,
    // so it overrides the flag; canceled + no GPS is exactly what a
    // real cancellation looks like (a canceled trip has no vehicle
    // transmitting), so that's when we trust it.
    const isCanceled = bus.canceled === "1" && !isLive;
    return { isArrived, isLive, isCanceled };
  };

  const safeArrivals = arrivals || [];
  const isGrouped = view === "grouped";

  // One group per route + headsign, in order of each group's soonest bus
  // (the feed is already chronological, so first appearance wins).
  const groups = [];
  if (isGrouped) {
    const byKey = new Map();
    for (const bus of safeArrivals) {
      const key = `${bus.route}|${bus.headsign}`;
      let group = byKey.get(key);
      if (!group) {
        group = { key, route: bus.route, headsign: bus.headsign, buses: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.buses.push(bus);
    }
  }

  const routesByDirection = safeArrivals.reduce((acc, bus) => {
    if (bus.arrived || !bus.direction) return acc;
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
                color: isFavorited ? "var(--danger)" : "currentColor",
                flexShrink: 0,
              }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {isFavorited ? "Added to Favorites" : "Add to Favorites"}
          </button>
        </div>
      )}

      {(lastUpdated || onChangeView) && (
        <div className={styles.lastUpdatedRow}>
          {lastUpdated && (
            <span className={styles.lastUpdated}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {lastUpdated && onRefresh && (
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
          {onChangeView && (
            <div className={styles.viewSeg} role="group" aria-label="Arrivals view">
              {[
                ["list", "List"],
                ["grouped", "Grouped"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`${styles.viewSegBtn} ${view === value ? styles.viewSegActive : ""}`}
                  onClick={() => onChangeView(value)}
                  aria-pressed={view === value}
                >
                  {label}
                </button>
              ))}
            </div>
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

      {isGrouped && (
        <div className={styles.list}>
          {groups.map((group) => {
            const shown = group.buses.slice(0, 3);
            const extra = group.buses.length - shown.length;
            return (
              <div key={group.key} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.routeBadge}>{group.route}</div>
                  <div className={styles.headsign}>{group.headsign}</div>
                  {extra > 0 && (
                    <span className={styles.moreCount}>+{extra} later</span>
                  )}
                </div>
                <div className={styles.tiles}>
                  {shown.map((bus) => {
                    const { isArrived, isLive, isCanceled } = getStatus(bus);
                    const isTracking = selectedBus?.id === bus.id;
                    const { value, unit } = isArrived
                      ? { value: "✓", unit: "Arrived" }
                      : isCanceled
                        ? { value: "—", unit: "Canceled" }
                        : getTileTime(bus.stopTime, bus.date);
                    const canTrack = isLive && !isArrived;
                    const Tile = canTrack ? "button" : "div";
                    return (
                      <Tile
                        key={bus.id}
                        className={`${styles.tile} ${isArrived ? styles.tileArrived : ""} ${isCanceled ? styles.tileCanceled : ""} ${isTracking ? styles.tileTracking : ""}`}
                        {...(canTrack && {
                          type: "button",
                          onClick: () => onShowMap(bus),
                          disabled: trackingLoading || isTracking,
                          "aria-label": `Track route ${group.route} bus #${bus.vehicle}, ${value} ${unit}, ${bus.stopTime}`,
                        })}
                      >
                        <span className={styles.tileValue}>{value}</span>
                        {unit && <span className={styles.tileUnit}>{unit}</span>}
                        <span className={styles.tileClock}>{bus.stopTime}</span>
                        {!isArrived && !isCanceled && (
                          <span
                            className={`${styles.liveTag} ${isLive ? styles.live : styles.scheduled}`}
                          >
                            {isTracking
                              ? trackingLoading
                                ? "Loading..."
                                : "● Tracking"
                              : isLive
                                ? "● Live · Track"
                                : "○ Scheduled"}
                          </span>
                        )}
                      </Tile>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isGrouped && (
      <div className={styles.list}>
        {safeArrivals.map((bus) => {
          const { isArrived, isLive, isCanceled } = getStatus(bus);

          return (
          <div
            key={bus.id}
            className={`${styles.card} ${isArrived ? styles.arrivedCard : ""} ${isCanceled ? styles.canceled : ""}`}
          >
            <div className={styles.cardTop}>
              <div className={styles.routeBadge}>{bus.route}</div>
              <div className={styles.headsign}>{bus.headsign}</div>
              <div className={isArrived ? styles.arrivedTime : styles.time}>
                {isArrived
                  ? "Arrived"
                  : isCanceled
                    ? "—"
                    : getMinutesUntil(bus.stopTime, bus.date)}
              </div>
            </div>

            <div className={styles.cardBottom}>
              {isArrived ? (
                <>
                  <span className={styles.arrivedTag}>✓ Arrived</span>
                  <span className={styles.scheduledTime}>Due {bus.stopTime}</span>
                  {bus.vehicle && (
                    <span className={styles.vehicle}>Bus #{bus.vehicle}</span>
                  )}
                </>
              ) : (
                <>
                  <span
                    className={`${styles.liveTag} ${isLive ? styles.live : isCanceled ? styles.canceledPill : styles.scheduled}`}
                  >
                    {isLive ? "● Live" : isCanceled ? "○ Canceled" : "○ Scheduled"}
                  </span>
                  <span className={styles.scheduledTime}>{bus.stopTime}</span>
                  {isLive && (
                    <span className={styles.vehicle}>Bus #{bus.vehicle}</span>
                  )}
                  {isLive &&
                    (selectedBus?.id === bus.id ? (
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
                    ))}
                </>
              )}
            </div>
          </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

export default ArrivalsList;
