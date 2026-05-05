import { useState, useEffect } from "react";
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
import RoutesTab from "./components/RoutesTab";
import SettingsTab from "./components/SettingsTab";
import Toast from "./components/Toast";
import { useArrivals } from "./hooks/useArrivals";
import { useFavorites } from "./hooks/useFavorites";
import { useNearbyStops } from "./hooks/useNearbyStops";
import { useBusTracking } from "./hooks/useBusTracking";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useStopHistory } from "./hooks/useStopHistory";
import { useSettings } from "./hooks/useSettings";
import { API_BASE } from "./constants";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function App() {
  // Settings must be first — other hooks depend on settings.searchRadius
  const { settings, updateSetting } = useSettings();

  const [searchQuery, setSearchQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [activeTab, setActiveTab] = useState("nearby");
  const [trackingView, setTrackingView] = useState(false);
  const [arrivalsTab, setArrivalsTab] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);
  const [toastFading, setToastFading] = useState(false);
  const [toastType, setToastType] = useState("add");

  // Routes state
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
    clearArrivals,
  } = useArrivals();

  const {
    favorites,
    saveToFavorites,
    removeFavorite,
    clearFavorites,
    isCurrentStopFavorited,
  } = useFavorites();

  const {
    nearbyStops,
    nearbyStopsMap,
    userLocation,
    searchingAddress,
    locating,
    searchByAddress,
    findNearbyStops,
    refindNearbyStops,
    clearNearbyStops,
  } = useNearbyStops(setError, settings.searchRadius);

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

  const { isPulling, pullDistance } = usePullToRefresh(
    () => fetchArrivals(currentStop.id),
    !!arrivals,
  );

  const [mapCenter, setMapCenter] = useState(null);

  // Re-run nearby stops when search radius changes
  useEffect(() => {
    if (activeTab === "nearby" && userLocation) {
      refindNearbyStops(
        userLocation.lat,
        userLocation.lon,
        settings.searchRadius,
      );
    }
  }, [settings.searchRadius]);

  // Fetch routes list when routes tab is opened
  useEffect(() => {
    if (activeTab === "routes" && !routes && !routesLoading) {
      fetchRoutes();
    }
  }, [activeTab]);

  useEffect(() => {
    if (userLocation) {
      refindNearbyStops(
        userLocation.lat,
        userLocation.lon,
        settings.searchRadius,
      );
    }
  }, [settings.searchRadius]);

  const handleFetchArrivals = async (stopId, tab) => {
    clearBusTracking();
    setTrackingView(false);
    const stopName = await fetchArrivals(stopId);
    addToHistory(stopId, stopName);
    setArrivalsTab(tab);
  };

  const showToast = (message, type = "add") => {
    setToast(message);
    setToastType(type);
    setToastFading(false);
    setTimeout(() => setToastFading(true), 2000);
    setTimeout(() => setToast(null), 3200);
  };

  const fetchRoutes = async () => {
    setRoutesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/routes`);
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
    setRouteStopsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/route/${route.route_id}/stops`);
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
          r.route_short_name.toLowerCase().includes(q) ||
          r.route_long_name.toLowerCase().includes(q)
        );
      })
    : [];

  const handleSearch = () => {
    if (/^\d+$/.test(searchQuery.trim())) {
      handleFetchArrivals(searchQuery.trim(), activeTab);
    } else {
      searchByAddress(searchQuery);
    }
  };

  const searchProps = {
    query: searchQuery,
    setQuery: setSearchQuery,
    onSearch: handleSearch,
    searching: searchingAddress,
    nearbyStops,
    onSelectStop: (stopId) => {
      handleFetchArrivals(stopId, activeTab);
      clearNearbyStops();
      setSearchQuery("");
    },
    onClear: () => {
      setSearchQuery("");
      clearNearbyStops();
    },
  };

  const tabContent = (
    <>
      {activeTab === "history" && (!arrivals || arrivalsTab !== "history") && (
        <StopHistory
          stopHistory={stopHistory}
          onSelectStop={(stopId) => handleFetchArrivals(stopId, "history")}
          onRemoveStop={removeFromHistory}
          onClearHistory={clearHistory}
        />
      )}

      {activeTab === "favorites" &&
        (!arrivals || arrivalsTab !== "favorites") && (
          <Favorites
            favorites={favorites}
            onSelectStop={(stopId) => handleFetchArrivals(stopId, "favorites")}
            onRemoveFavorite={(stopId) => {
              removeFavorite(stopId);
              showToast("Stop removed", "remove");
            }}
          />
        )}

      {activeTab === "routes" && arrivalsTab !== "routes" && (
        <RoutesTab
          routes={routes}
          routesLoading={routesLoading}
          filteredRoutes={filteredRoutes}
          selectedRoute={selectedRoute}
          routeStops={routeStops}
          routeStopsLoading={routeStopsLoading}
          onSelectRoute={fetchRouteStops}
          onClearRoute={() => {
            setSelectedRoute(null);
            setRouteStops(null);
          }}
          onSelectStop={(stopId) => handleFetchArrivals(stopId, "routes")}
        />
      )}

      {activeTab === "settings" && (
        <SettingsTab
          settings={settings}
          onUpdateSetting={updateSetting}
          onClearHistory={clearHistory}
          onClearFavorites={() => {
            clearFavorites();
            showToast("Favorites cleared", "remove");
          }}
        />
      )}

      {loading && <p>Loading arrivals...</p>}
      {error && <p>{error}</p>}
      {isPulling && (
        <p>Refreshing... ({Math.round((pullDistance / 80) * 100)}%)</p>
      )}

      <ErrorBoundary>
        {arrivals && arrivalsTab === activeTab && (
          <ArrivalsList
            arrivals={arrivals}
            selectedBus={selectedBus}
            onShowMap={(bus) => {
              fetchBusLocation(bus);
              setTrackingView(true);
            }}
            currentStop={currentStop}
            isFavorited={isCurrentStopFavorited(currentStop)}
            onSaveStop={(isFavorited) => {
              if (isFavorited) {
                removeFavorite(currentStop.id);
                showToast("Stop removed", "remove");
              } else {
                setShowSaveModal(true);
              }
            }}
            lastUpdated={lastUpdated}
            arrivalsTab={arrivalsTab}
            onBack={
              arrivalsTab === "favorites" ||
              arrivalsTab === "history" ||
              arrivalsTab === "routes" ||
              (arrivalsTab === "nearby" && window.innerWidth < 768)
                ? () => {
                    if (arrivalsTab === "nearby") clearArrivals();
                    setArrivalsTab(null);
                  }
                : null
            }
            onBackToTracking={busLocation ? () => setTrackingView(true) : null}
          />
        )}
      </ErrorBoundary>
    </>
  );

  return (
    <div className={styles.shell}>
      {/* Mobile-only top search bar */}
      {(activeTab === "nearby" || activeTab === "routes") && !trackingView && (
        <div className={styles.topBar}>
          {activeTab === "nearby" && <AddressSearch {...searchProps} />}
          {activeTab === "routes" && (
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
                style={{
                  width: 18,
                  height: 18,
                  color: "var(--text-muted)",
                  flexShrink: 0,
                }}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
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
          )}
        </div>
      )}

      {/* Center column */}
      <main className={styles.main}>
        {/* Desktop search bar */}
        <div className={styles.desktopSearch}>
          {activeTab === "routes" ? (
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
                style={{
                  width: 18,
                  height: 18,
                  color: "var(--text-muted)",
                  flexShrink: 0,
                }}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
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
          ) : (
            <AddressSearch {...searchProps} />
          )}
        </div>

        <div className={styles.desktopContent}>
          {/* Nearby map — mobile only (desktop uses mapPanel) */}
          {activeTab === "nearby" && !arrivals && (
            <div className={styles.mobileMapOnly}>
              <NearbyStopsMap
                userLocation={userLocation}
                nearbyStopsMap={nearbyStopsMap}
                onSelectStop={(stopId) => handleFetchArrivals(stopId, "nearby")}
                onMount={findNearbyStops}
                mapCenter={mapCenter}
                onMapMove={setMapCenter}
              />
            </div>
          )}

          {tabContent}
        </div>
      </main>

      {/* Desktop map panel */}
      <div className={styles.mapPanel}>
        <ErrorBoundary>
          {trackingView && busLocation ? (
            <>
              <div
                style={{
                  padding: "12px 16px",
                  background: "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => {
                    setTrackingView(false);
                    clearBusTracking();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "14px",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ← Back to map
                </button>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                  }}
                >
                  Route {busLocation.route_short_name} — {busLocation.headsign}
                </p>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <BusTrackingMap
                  busLocation={busLocation}
                  selectedBus={selectedBus}
                  busShape={busShape}
                  tripStops={tripStops}
                  onGetArrivals={(stopId) => {
                    fetchArrivals(stopId).then((stopName) => {
                      addToHistory(stopId, stopName);
                      setArrivalsTab(activeTab);
                    });
                  }}
                />
              </div>
            </>
          ) : (
            <NearbyStopsMap
              userLocation={userLocation}
              nearbyStopsMap={nearbyStopsMap}
              locating={locating}
              onSelectStop={(stopId) => handleFetchArrivals(stopId, "nearby")}
              onMount={() => {}}
              mapCenter={mapCenter}
              onMapMove={setMapCenter}
              fullHeight
              searchRadius={settings.searchRadius}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* Mobile bus tracking overlay */}
      <ErrorBoundary>
        {trackingView && busLocation && (
          <div
            className={styles.mobileTrackingOverlay}
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--bg)",
              zIndex: 1100,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                background: "var(--surface)",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  fontSize: "14px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ← Back to arrivals
              </button>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                Route {busLocation.route_short_name} — {busLocation.headsign}
              </p>
            </div>
            <div style={{ flex: 1, height: 0 }}>
              <BusTrackingMap
                busLocation={busLocation}
                selectedBus={selectedBus}
                busShape={busShape}
                tripStops={tripStops}
                onGetArrivals={(stopId) => {
                  fetchArrivals(stopId).then((stopName) => {
                    addToHistory(stopId, stopName);
                    setArrivalsTab(activeTab);
                  });
                }}
              />
            </div>
          </div>
        )}
      </ErrorBoundary>

      {/* Nav */}
      <nav className={styles.bottomNav}>
        <div className={styles.brandMark}>
          <img src="/dabus-icon.png" alt="DaBus" />
        </div>
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
          onClick={() => setActiveTab("routes")}
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
          className={`${styles.navBtn} ${activeTab === "settings" ? styles.active : ""}`}
          onClick={() => setActiveTab("settings")}
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
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </nav>

      {showSaveModal && currentStop && (
        <SaveStopModal
          stop={currentStop}
          onSave={(customName) => {
            saveToFavorites(currentStop, customName);
            setShowSaveModal(false);
            showToast("Stop saved");
          }}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      {toast && <Toast message={toast} type={toastType} fading={toastFading} />}
    </div>
  );
}

export default App;
