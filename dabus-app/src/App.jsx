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
import Toast from "./components/Toast";
import PullToRefreshIndicator from "./components/PullToRefreshIndicator";
import { useArrivals } from "./hooks/useArrivals";
import { useFavorites } from "./hooks/useFavorites";
import { useNearbyStops } from "./hooks/useNearbyStops";
import { useBusTracking } from "./hooks/useBusTracking";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { useStopHistory } from "./hooks/useStopHistory";
import { API_BASE } from "./constants";
import { useSettings } from "./hooks/useSettings";
import SettingsTab from "./components/SettingsTab";

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
  const [toastType, setToastType] = useState("add");
  const [routes, setRoutes] = useState(null);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeStops, setRouteStops] = useState(null);
  const [routeStopsLoading, setRouteStopsLoading] = useState(false);
  const { settings, updateSetting } = useSettings();

  const {
    arrivals,
    currentStop,
    loading,
    error,
    setError,
    fetchArrivals,
    lastUpdated,
  } = useArrivals();

  const {
    favorites,
    saveToFavorites,
    removeFavorite,
    clearFavorites,
    isCurrentStopFavorited,
  } = useFavorites();

  const [arrivalsTab, setArrivalsTab] = useState(null);

  const {
    nearbyStops,
    nearbyStopsMap,
    userLocation,
    searchingAddress,
    searchByAddress,
    locating,
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

  useEffect(() => {
    console.log(
      "useEffect fired",
      activeTab,
      settings.searchRadius,
      userLocation,
    );
    if (activeTab === "nearby" && userLocation) {
      refindNearbyStops(
        userLocation.lat,
        userLocation.lon,
        settings.searchRadius,
      );
    }
  }, [activeTab, settings.searchRadius]);

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
    setRouteStops(null);
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

      {activeTab === "routes" && arrivalsTab !== "routes" && (
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
            searchRadius={settings.searchRadius}
            onSelectStop={(stopId) => handleFetchArrivals(stopId, "nearby")}
            onMount={() => {
              if (userLocation) {
                refindNearbyStops(
                  userLocation.lat,
                  userLocation.lon,
                  settings.searchRadius,
                );
              } else {
                findNearbyStops();
              }
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

        {activeTab === "favorites" && (
          <>
            {(!arrivals || arrivalsTab !== "favorites") && (
              <Favorites
                favorites={favorites}
                onSelectStop={(stopId) =>
                  handleFetchArrivals(stopId, "favorites")
                }
                onRemoveFavorite={(stopId) => {
                  removeFavorite(stopId);
                  showToast("Removed from favorites", "remove");
                }}
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

        {activeTab === "settings" && (
          <SettingsTab
            settings={settings}
            onUpdateSetting={(key, value) => {
              updateSetting(key, value);
              if (key === "searchRadius" && userLocation) {
                refindNearbyStops(userLocation.lat, userLocation.lon, value);
              }
            }}
            onClearHistory={clearHistory}
            onClearFavorites={clearFavorites}
          />
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

        <PullToRefreshIndicator
          isPulling={isPulling}
          pullDistance={pullDistance}
          triggered={triggered}
        />

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
              onSaveStop={(alreadySaved) => {
                if (alreadySaved) {
                  removeFavorite(currentStop.id);
                  showToast("Removed from favorites", "remove");
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
            showToast(`Added "${customName}" to favorites`);
          }}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      {toast && <Toast message={toast} type={toastType} fading={toastFading} />}
    </div>
  );
}

export default App;
