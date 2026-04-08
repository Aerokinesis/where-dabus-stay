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

// Fix for default marker icon not showing in React
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

  const {
    nearbyStops,
    nearbyStopsMap,
    userLocation,
    searchingAddress,
    searchByAddress,
    findNearbyStops,
    clearNearbyStops,
  } = useNearbyStops(setError);

  const { selectedBus, busLocation, busShape, tripStops, fetchBusLocation } =
    useBusTracking(setError);

  const { stopHistory, addToHistory, clearHistory } = useStopHistory();

  const handleFetchArrivals = (stopId) => {
    fetchArrivals(stopId);
    addToHistory(stopId);
  };

  const { isPulling, pullDistance } = usePullToRefresh(
    () => fetchArrivals(currentStop.id),
    !!arrivals,
  );

return (
  <div className={styles.shell}>
    <div className={styles.topBar}>
      <AddressSearch
        query={searchQuery}
        setQuery={setSearchQuery}
        onSearch={() => {
          if (/^\d+$/.test(searchQuery.trim())) {
            handleFetchArrivals(searchQuery.trim());
          } else {
            searchByAddress(searchQuery);
          }
        }}
        searching={searchingAddress}
        nearbyStops={nearbyStops}
        onSelectStop={(stopId) => {
          handleFetchArrivals(stopId);
          clearNearbyStops();
          setSearchQuery("");
        }}
      />
    </div>

    <main className={styles.main}>
      {activeTab === "nearby" && (
        <div>
          <button onClick={findNearbyStops}>Find Stops Near Me</button>
          <NearbyStopsMap
            userLocation={userLocation}
            nearbyStopsMap={nearbyStopsMap}
            onSelectStop={handleFetchArrivals}
          />
        </div>
      )}
      {activeTab === "history" && (
        <StopHistory
          stopHistory={stopHistory}
          onSelectStop={handleFetchArrivals}
          onClearHistory={clearHistory}
        />
      )}
      {activeTab === "favorites" && (
        <Favorites
          favorites={favorites}
          onSelectStop={handleFetchArrivals}
          onRemoveFavorite={removeFavorite}
        />
      )}

      {loading && <p>Loading arrivals...</p>}
      {error && <p>{error}</p>}
      {isPulling && (
        <p>Refreshing... ({Math.round((pullDistance / 80) * 100)}%)</p>
      )}

      <ErrorBoundary>
        {arrivals && (
          <ArrivalsList
            arrivals={arrivals}
            selectedBus={selectedBus}
            onShowMap={fetchBusLocation}
            currentStop={currentStop}
            isFavorited={isCurrentStopFavorited(currentStop)}
            onSaveStop={() => setShowSaveModal(true)}
            lastUpdated={lastUpdated}
          />
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        {busLocation && (
          <BusTrackingMap
            busLocation={busLocation}
            selectedBus={selectedBus}
            busShape={busShape}
            tripStops={tripStops}
          />
        )}
      </ErrorBoundary>
    </main>

    <nav className={styles.bottomNav}>
      <button
        className={`${styles.navBtn} ${activeTab === "nearby" ? styles.active : ""}`}
        onClick={() => setActiveTab("nearby")}
      >
        <span>Nearby Stops</span>
      </button>
      <button
        className={`${styles.navBtn} ${activeTab === "history" ? styles.active : ""}`}
        onClick={() => setActiveTab("history")}
      >
        <span>Recent</span>
      </button>
      <button
        className={`${styles.navBtn} ${activeTab === "favorites" ? styles.active : ""}`}
        onClick={() => setActiveTab("favorites")}
      >
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
