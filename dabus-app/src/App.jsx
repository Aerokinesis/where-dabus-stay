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
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [activeTab, setActiveTab] = useState("nearby");
  const [trackingView, setTrackingView] = useState(false);

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
    findNearbyStops,
    clearNearbyStops,
  } = useNearbyStops(setError);

  const {
    selectedBus,
    busLocation,
    busShape,
    tripStops,
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

  const { isPulling, pullDistance } = usePullToRefresh(
    () => fetchArrivals(currentStop.id),
    !!arrivals,
  );

  return (
    <div className={styles.shell}>
      {activeTab === "nearby" && (
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

      <main className={styles.main}>
        {activeTab === "nearby" && (
          <NearbyStopsMap
            userLocation={userLocation}
            nearbyStopsMap={nearbyStopsMap}
            onSelectStop={(stopId) => handleFetchArrivals(stopId, "nearby")}
            onMount={findNearbyStops}
          />
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
              onSaveStop={() => setShowSaveModal(true)}
              lastUpdated={lastUpdated}
              arrivalsTab={arrivalsTab}
              onBack={
                arrivalsTab === "favorites" || arrivalsTab === "history"
                  ? () => setArrivalsTab(null)
                  : null
              }
            />
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          {trackingView && busLocation && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "var(--bg)",
                zIndex: 200,
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
                <ErrorBoundary>
                  <BusTrackingMap
                    busLocation={busLocation}
                    selectedBus={selectedBus}
                    busShape={busShape}
                    tripStops={tripStops}
                  />
                </ErrorBoundary>
              </div>
            </div>
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
      </nav>

      {showSaveModal && currentStop && (
        <SaveStopModal
          stop={currentStop}
          onSave={(customName) => {
            saveToFavorites(currentStop, customName);
            setShowSaveModal(false);
          }}
          onCancel={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}

export default App;
