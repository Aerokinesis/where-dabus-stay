import { useState, useEffect } from "react";
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
  const [arrivals, setArrivals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [address, setAddress] = useState("");
  const [nearbyStops, setNearbyStops] = useState(null);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [selectedBus, setSelectedBus] = useState(null);
  const [busLocation, setBusLocation] = useState(null);
  const [busShape, setBusShape] = useState(null);
  const [tripStops, setTripStops] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyStopsMap, setNearbyStopsMap] = useState(null);
  const [currentStop, setCurrentStop] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("dabus-favorites");
    return saved ? JSON.parse(saved) : [];
  });
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    if (!currentStop) return;

    const interval = setInterval(() => {
      fetchArrivals(currentStop.id);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentStop]);

  const fetchArrivals = async (stop) => {
    setLoading(true);
    setError(null);
    setNearbyStops(null);

    const stopToFetch = stop || stopNumber;

    try {
      const [arrivalsResponse, stopResponse] = await Promise.all([
        fetch(`http://localhost:3001/api/arrivals?stop=${stopToFetch}`),
        fetch(`http://localhost:3001/api/stop/${stopToFetch}`),
      ]);

      const arrivalsData = await arrivalsResponse.json();
      const stopData = await stopResponse.json();

      setArrivals(arrivalsData.arrivals);
      setCurrentStop({
        id: stopToFetch,
        name: stopData.stop_name
          ? stopData.stop_name
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : `Stop #${stopToFetch}`,
      });
    } catch (_err) {
      setError(
        "Could not fetch arrivals. Check your stop number and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const searchByAddress = async () => {
    setSearchingAddress(true);
    setError(null);
    setArrivals(null);
    setNearbyStops(null);

    const url = `http://localhost:3001/api/nearby-stops?address=${encodeURIComponent(address)}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setNearbyStops(data.stops);
      }
    } catch (_err) {
      setError("Could not search for nearby stops. Try again.");
    } finally {
      setSearchingAddress(false);
    }
  };

  const fetchBusLocation = async (bus) => {
    if (bus.estimated !== "1") return;
    if (selectedBus?.id === bus.id) {
      setSelectedBus(null);
      setBusLocation(null);
      setBusShape(null);
      setTripStops(null);
      return;
    }

    setSelectedBus(bus);

    if (
      bus.latitude &&
      bus.longitude &&
      bus.latitude !== "0" &&
      bus.longitude !== "0"
    ) {
      setBusLocation({
        latitude: bus.latitude,
        longitude: bus.longitude,
        number: bus.vehicle,
        route_short_name: bus.route,
        headsign: bus.headsign,
        adherence: null,
      });

      try {
        const response = await fetch(
          `http://localhost:3001/api/shape/${bus.shape}`,
        );
        const data = await response.json();
        if (data.shape) setBusShape(data.shape);
      } catch (_err) {}

      try {
        const response = await fetch(
          `http://localhost:3001/api/trip/${bus.trip}/stops`,
        );
        const data = await response.json();
        if (data.stops) setTripStops(data.stops);
      } catch (_err) {}
    } else {
      setError("No live location available for this bus.");
    }
  };

  const findNearbyStops = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserLocation({ lat, lon });

        try {
          const response = await fetch(
            `http://localhost:3001/api/nearby-stops-by-coords?lat=${lat}&lon=${lon}`,
          );
          const data = await response.json();
          if (data.stops) setNearbyStopsMap(data.stops);
        } catch (_err) {
          setError("Could not find nearby stops.");
        }
      },
      () => {
        setError("Could not get your location. Please allow location access.");
      },
    );
  };

  const saveToFavorites = (customName) => {
    const newFavorite = {
      stop_id: currentStop.id,
      name: currentStop.name,
      custom_name: customName,
    };
    const updated = [
      ...favorites.filter((f) => f.stop_id !== currentStop.id),
      newFavorite,
    ];
    setFavorites(updated);
    localStorage.setItem("dabus-favorites", JSON.stringify(updated));
    setShowSaveModal(false);
  };

  const removeFavorite = (stopId) => {
    const updated = favorites.filter((f) => f.stop_id !== stopId);
    setFavorites(updated);
    localStorage.setItem("dabus-favorites", JSON.stringify(updated));
  };

  const isCurrentStopFavorited = () => {
    return favorites.some((f) => f.stop_id === currentStop?.id);
  };

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
          onSearch={() => fetchArrivals()}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <AddressSearch
          address={address}
          setAddress={setAddress}
          onSearch={searchByAddress}
          searching={searchingAddress}
          nearbyStops={nearbyStops}
          onSelectStop={fetchArrivals}
        />
      </ErrorBoundary>

      {loading && <p>Loading arrivals...</p>}
      {error && <p>{error}</p>}

      <ErrorBoundary>
        {arrivals && (
          <ArrivalsList
            arrivals={arrivals}
            selectedBus={selectedBus}
            onShowMap={fetchBusLocation}
            currentStop={currentStop}
            isFavorited={isCurrentStopFavorited()}
            onSaveStop={() => setShowSaveModal(true)}
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
          onSave={saveToFavorites}
          onCancel={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}

export default App;
