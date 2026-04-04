import { useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import NearbyStopsMap from "./components/NearbyStopsMap";
import StopSearch from "./components/StopSearch";
import AddressSearch from "./components/AddressSearch";
import ArrivalsList from "./components/ArrivalsList";
import BusTrackingMap from "./components/BusTrackingMap";
import ErrorBoundary from "./components/ErrorBoundary";
import Favorites from "./components/Favorites";
import SaveStopModal from "./components/SaveStopModal";
import { useArrivals } from "./hooks/useArrivals";
import { useFavorites } from "./hooks/useFavorites";
import { useNearbyStops } from "./hooks/useNearbyStops";
import { useBusTracking } from "./hooks/useBusTracking";
import { usePullToRefresh } from "./hooks/usePullToRefresh";

// Fix for default marker icon not showing in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function App() {
  const [stopNumber, setStopNumber] = useState("");
  const [address, setAddress] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);

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
  } = useNearbyStops(setError);

  const { selectedBus, busLocation, busShape, tripStops, fetchBusLocation } =
    useBusTracking(setError);

  const { isPulling, pullDistance } = usePullToRefresh(
    () => fetchArrivals(currentStop.id),
    !!arrivals,
  );

  return (
    <div>
      <h1>DaBus</h1>

      <Favorites
        favorites={favorites}
        onSelectStop={fetchArrivals}
        onRemoveFavorite={removeFavorite}
      />

      <ErrorBoundary>
        <div>
          <h2>Nearby Stops</h2>
          <button onClick={findNearbyStops}>Find Stops Near Me</button>
          <NearbyStopsMap
            userLocation={userLocation}
            nearbyStopsMap={nearbyStopsMap}
            onSelectStop={fetchArrivals}
          />
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <StopSearch
          stopNumber={stopNumber}
          setStopNumber={setStopNumber}
          onSearch={() => fetchArrivals(stopNumber)}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <AddressSearch
          address={address}
          setAddress={setAddress}
          onSearch={() => searchByAddress(address)}
          searching={searchingAddress}
          nearbyStops={nearbyStops}
          onSelectStop={fetchArrivals}
        />
      </ErrorBoundary>

      {isPulling && (
        <p>Refreshing... ({Math.round((pullDistance / 80) * 100)}%)</p>
      )}
      {loading && <p>Loading arrivals...</p>}
      {error && <p>{error}</p>}

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
