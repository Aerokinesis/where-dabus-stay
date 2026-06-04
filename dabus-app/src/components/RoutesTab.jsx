import styles from "./RoutesTab.module.css";

function RoutesTab({
  routes,
  routesLoading,
  filteredRoutes,
  selectedRoute,
  routeStops,
  routeStopsLoading,
  onSelectRoute,
  onClearRoute,
  onSelectStop,
  onViewOnMap,
}) {
  const titleCase = (str) =>
    str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      {selectedRoute ? (
        <>
          <button className={styles.backBtn} onClick={onClearRoute}>
            ← All routes
          </button>
          <div className={styles.routeHeader}>
            <div className={styles.routeBadge}>
              {selectedRoute.route_short_name}
            </div>
            <div className={styles.routeName}>
              {selectedRoute.route_long_name}
            </div>
          </div>
          {onViewOnMap && (
            <button
              type="button"
              className={styles.viewOnMapBtn}
              onClick={onViewOnMap}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              View on map
            </button>
          )}
          {routeStopsLoading && (
            <p className={styles.status}>Loading stops…</p>
          )}
          {routeStops && (
            <div className={styles.stopList}>
              <p className={styles.stopListLabel}>Stops on this route</p>
              {routeStops.map((stop) => (
                <div key={stop.stop_id} className={styles.stopRow}>
                  <div>
                    <div className={styles.stopName}>
                      {titleCase(stop.stop_name)}
                    </div>
                    <div className={styles.stopId}>Stop #{stop.stop_id}</div>
                  </div>
                  <button
                    className={styles.arrivalsBtn}
                    onClick={() => onSelectStop(stop.stop_id)}
                  >
                    Arrivals
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {routesLoading && (
            <p className={styles.status}>Loading routes…</p>
          )}
          {!routesLoading && routes && filteredRoutes.length === 0 && (
            <p className={styles.status}>No routes found.</p>
          )}
          <div className={styles.routeList}>
            {filteredRoutes.map((route) => (
              <div
                key={route.route_id}
                className={styles.routeRow}
                onClick={() => onSelectRoute(route)}
              >
                <div className={styles.routeBadge}>
                  {route.route_short_name}
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.routeRowName}>
                    {route.route_long_name}
                  </div>
                  {route.route_description && (
                    <div className={styles.routeRowDesc}>
                      {route.route_description}
                    </div>
                  )}
                </div>
                <span className={styles.arrow}>›</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default RoutesTab;