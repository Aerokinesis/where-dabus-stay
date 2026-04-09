import { useState } from "react";
import styles from "./App.module.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import NearbyStopsMap from "./components/NearbyStopsMap";
import AddressSearch from "./components/AddressSearch";
import ArrivalsList from "./components/ArrivalsList";
import BusTrackingMap from "./components/BusTrackingMap";
import ErrorBoundary from "./components/ErrorBoundary";
import Favorites from "./components/Favorites";
import SaveStopModal from "./components/SaveStopModal";
import StopHistory from "./components/StopHistory";
import { useArrivals } from "./hooks/useArrivals";
import { useFavorites } from "./hooks/useFavorites";
import { useNearbyStops } from "./hooks/useNearbyStops";
import { useBusTracking } from "./hooks/useBusTracking";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useStopHistory } from "./hooks/useStopHistory";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [activeTab, setActiveTab] = useState("nearby");
  const [trackingView, setTrackingView] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastFading, setToastFading] = useState(false);
  const [routes, setRoutes] = useState(null);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeStops, setRouteStops] = useState(null);
  const [routeStopsLoading, setRouteStopsLoading] = useState(false);

  const {
    arrivals,
    currentStop,
    loading,
    error,
    setError,
    fetchArrivals,
    lastUpdated,
  } = useArrivals();

  const { favorites, saveToFavorites, removeFavorite, isCurrentStopFavorited } =
    useFavorites();

  const [arrivalsTab, setArrivalsTab] = useState(null);

  const {
    nearbyStops,
    nearbyStopsMap,
    userLocation,
    searchingAddress,
    searchByAddress,
    locating,
    findNearbyStops,
    clearNearbyStops,
  } = useNearbyStops(setError);

  const {
    selectedBus,
    busLocation,
    busShape,
    tripStops,
    trackingLoading,
    fetchBusLocation,
    clearBusTracking,
  } = useBusTracking(setError);

  const { stopHistory, addToHistory, removeFromHistory, clearHistory } =
    useStopHistory();

  const handleFetchArrivals = async (stopId, tab) => {
    clearBusTracking();
    setTrackingView(false);
    const stopName = await fetchArrivals(stopId);
    addToHistory(stopId, stopName);
    setArrivalsTab(tab);
  };

  const showToast = (message) => {
    setToast(message);
    setToastFading(false);
    setTimeout(() => setToastFading(true), 2000);
    setTimeout(() => setToast(null), 3200);
  };

  const fetchRoutes = async () => {
    if (routes) return;
    setRoutesLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/routes");
      const data = await res.json();
      setRoutes(data.routes);
    } catch {
      setError("Could not load routes.");
    } finally {
      setRoutesLoading(false);
    }
  };

  const fetchRouteStops = async (route) => {
    setSelectedRoute(route);
    setRouteStops(null);
    setRouteStopsLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/route/${route.route_id}/stops`,
      );
      const data = await res.json();
      setRouteStops(data.stops);
    } catch {
      setError("Could not load stops for this route.");
    } finally {
      setRouteStopsLoading(false);
    }
  };

  const filteredRoutes = routes
    ? routes.filter((r) => {
        const q = routeQuery.toLowerCase();
        return (
          r.route_short_name?.toLowerCase().includes(q) ||
          r.route_long_name?.toLowerCase().includes(q)
        );
      })
    : [];

  const { isPulling, pullDistance, triggered } = usePullToRefresh(
    () => fetchArrivals(currentStop.id),
    !!arrivals,
  );

  return (
    <div className={styles.shell}>
      {activeTab === "nearby" && !trackingView && (
        <div className={styles.topBar}>
          <AddressSearch
            query={searchQuery}
            setQuery={setSearchQuery}
            onSearch={() => {
              if (/^\d+$/.test(searchQuery.trim())) {
                handleFetchArrivals(searchQuery.trim(), activeTab);
              } else {
                searchByAddress(searchQuery);
              }
            }}
            searching={searchingAddress}
            nearbyStops={nearbyStops}
            onSelectStop={(stopId) => {
              handleFetchArrivals(stopId, activeTab);
              clearNearbyStops();
              setSearchQuery("");
            }}
            onClear={() => {
              setSearchQuery("");
              clearNearbyStops();
            }}
          />
        </div>
      )}

      {activeTab === "routes" && (
        <div className={styles.topBar}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "0 12px",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "var(--text)",
                fontSize: "15px",
                padding: "12px 0",
              }}
              placeholder="Search routes"
              value={routeQuery}
              onChange={(e) => setRouteQuery(e.target.value)}
            />
            {routeQuery && (
              <button
                onClick={() => setRouteQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: "14px",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      <main className={styles.main}>
        {activeTab === "nearby" && (
          <NearbyStopsMap
            userLocation={userLocation}
            nearbyStopsMap={nearbyStopsMap}
            locating={locating}
            onSelectStop={(stopId) => handleFetchArrivals(stopId, "nearby")}
            onMount={findNearbyStops}
          />
        )}

        {activeTab === "routes" && (
          <div>
            {selectedRoute ? (
              <>
                <button
                  onClick={() => {
                    setSelectedRoute(null);
                    setRouteStops(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "14px",
                    cursor: "pointer",
                    padding: "0 0 12px 0",
                    display: "block",
                  }}
                >
                  ← Routes
                </button>
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "12px 14px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      background: "var(--primary)",
                      color: "#fff",
                      fontSize: "15px",
                      fontWeight: 500,
                      padding: "4px 12px",
                      borderRadius: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    {selectedRoute.route_short_name}
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "var(--text)",
                      fontWeight: 500,
                    }}
                  >
                    {selectedRoute.route_long_name}
                  </div>
                </div>
                {routeStopsLoading && (
                  <p
                    style={{
                      fontSize: "14px",
                      color: "var(--text-muted)",
                      padding: "16px 0",
                    }}
                  >
                    Loading stops…
                  </p>
                )}
                {routeStops && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "10px",
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--text-muted)",
                        marginBottom: "4px",
                      }}
                    >
                      Stops on this route
                    </p>
                    {routeStops.map((stop) => (
                      <div
                        key={stop.stop_id}
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "var(--text)",
                              fontWeight: 500,
                            }}
                          >
                            {stop.stop_name
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              marginTop: "2px",
                            }}
                          >
                            Stop #{stop.stop_id}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleFetchArrivals(stop.stop_id, "routes")
                          }
                          style={{
                            background: "var(--primary)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "5px 10px",
                            fontSize: "11px",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
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
                  <p
                    style={{
                      fontSize: "14px",
                      color: "var(--text-muted)",
                      padding: "16px 0",
                    }}
                  >
                    Loading routes…
                  </p>
                )}
                {!routesLoading && routes && filteredRoutes.length === 0 && (
                  <p
                    style={{
                      fontSize: "14px",
                      color: "var(--text-muted)",
                      padding: "16px 0",
                    }}
                  >
                    No routes found.
                  </p>
                )}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {filteredRoutes.map((route) => (
                    <div
                      key={route.route_id}
                      onClick={() => fetchRouteStops(route)}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          background: "var(--primary)",
                          color: "#fff",
                          fontSize: "13px",
                          fontWeight: 500,
                          padding: "4px 10px",
                          borderRadius: "6px",
                          flexShrink: 0,
                          minWidth: "40px",
                          textAlign: "center",
                        }}
                      >
                        {route.route_short_name}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", color: "var(--text)" }}>
                          {route.route_long_name}
                        </div>
                      </div>
                      <span
                        style={{ color: "var(--text-muted)", fontSize: "16px" }}
                      >
                        ›
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "favorites" && (
          <>
            {(!arrivals || arrivalsTab !== "favorites") && (
              <Favorites
                favorites={favorites}
                onSelectStop={(stopId) =>
                  handleFetchArrivals(stopId, "favorites")
                }
                onRemoveFavorite={removeFavorite}
              />
            )}
          </>
        )}

        {activeTab === "history" && (
          <>
            {(!arrivals || arrivalsTab !== "history") && (
              <StopHistory
                stopHistory={stopHistory}
                onSelectStop={(stopId) =>
                  handleFetchArrivals(stopId, "history")
                }
                onRemoveStop={removeFromHistory}
                onClearHistory={clearHistory}
              />
            )}
          </>
        )}

        {loading && <p>Loading arrivals...</p>}
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "#2a1215",
              border: "1px solid #5c2326",
              borderRadius: "10px",
              padding: "12px 14px",
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
            <p style={{ fontSize: "14px", color: "#f87171", flex: 1 }}>
              {error}
            </p>
            <button
              onClick={() => setError(null)}
              style={{
                background: "none",
                border: "none",
                color: "#f87171",
                fontSize: "16px",
                cursor: "pointer",
                padding: "0",
                flexShrink: 0,
                opacity: 0.7,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {(isPulling || triggered) && (
          <div
            style={{
              position: "fixed",
              top: "60px",
              left: "50%",
              transform: triggered
                ? "translateX(-50%) translateY(48px)"
                : `translateX(-50%) translateY(${Math.min(pullDistance * 0.6, 48)}px)`,
              zIndex: 100,
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              transition: triggered
                ? "transform 0.2s ease, opacity 0.5s ease 0.2s"
                : "transform 0.05s ease",
              opacity: triggered ? 0 : 1,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: triggered
                  ? "rotate(360deg)"
                  : `rotate(${(pullDistance / 80) * 360}deg)`,
                transition: triggered
                  ? "transform 0.5s ease"
                  : "transform 0.05s ease",
                animation: triggered ? "spin 0.6s linear" : "none",
              }}
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
        )}

        <ErrorBoundary>
          {arrivals && arrivalsTab === activeTab && (
            <ArrivalsList
              arrivals={arrivals}
              selectedBus={selectedBus}
              trackingLoading={trackingLoading}
              onShowMap={(bus) => {
                fetchBusLocation(bus);
                setTrackingView(true);
              }}
              currentStop={currentStop}
              isFavorited={isCurrentStopFavorited(currentStop)}
              onSaveStop={() => {
                if (isCurrentStopFavorited(currentStop)) {
                  removeFavorite(currentStop.id);
                  showToast("Removed from favorites");
                } else {
                  setShowSaveModal(true);
                }
              }}
              lastUpdated={lastUpdated}
              arrivalsTab={arrivalsTab}
              onBack={
                arrivalsTab === "favorites" ||
                arrivalsTab === "history" ||
                arrivalsTab === "routes"
                  ? () => setArrivalsTab(null)
                  : null
              }
            />
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          {trackingView && busLocation && (
            <BusTrackingMap
              busLocation={busLocation}
              selectedBus={selectedBus}
              busShape={busShape}
              tripStops={tripStops}
              onBack={() => {
                setTrackingView(false);
                clearBusTracking();
              }}
            />
          )}
        </ErrorBoundary>
      </main>

      <nav className={styles.bottomNav}>
        <button
          className={`${styles.navBtn} ${activeTab === "nearby" ? styles.active : ""}`}
          onClick={() => setActiveTab("nearby")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          </svg>
          <span>Nearby</span>
        </button>

        <button
          className={`${styles.navBtn} ${activeTab === "routes" ? styles.active : ""}`}
          onClick={() => {
            setActiveTab("routes");
            fetchRoutes();
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="5" cy="6" r="2" fill="currentColor" />
            <circle cx="19" cy="18" r="2" fill="currentColor" />
            <path d="M7 6h4a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4" />
            <path d="M7 6h4" />
          </svg>
          <span>Routes</span>
        </button>

        <button
          className={`${styles.navBtn} ${activeTab === "favorites" ? styles.active : ""}`}
          onClick={() => setActiveTab("favorites")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>Favorites</span>
        </button>

        <button
          className={`${styles.navBtn} ${activeTab === "history" ? styles.active : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Recent</span>
        </button>
      </nav>

      {showSaveModal && currentStop && (
        <SaveStopModal
          stop={currentStop}
          onSave={(customName) => {
            saveToFavorites(currentStop, customName);
            setShowSaveModal(false);
            showToast(`Saved "${customName}"`);
          }}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            padding: "10px 18px",
            fontSize: "13px",
            color: "var(--text)",
            zIndex: 2000,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            animation: toastFading
              ? "fadeOut 1.2s ease forwards"
              : "fadeIn 0.4s ease",
          }}
        >
          <span style={{ color: "var(--accent)" }}>★</span>
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
