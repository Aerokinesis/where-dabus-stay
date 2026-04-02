import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

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
  const [satelliteView, setSatelliteView] = useState(false);
  const [tripStops, setTripStops] = useState(null);

  const fetchArrivals = async (stop) => {
    setLoading(true);
    setError(null);
    setNearbyStops(null);

    const stopToFetch = stop || stopNumber;
    const url = `http://localhost:3001/api/arrivals?stop=${stopToFetch}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      setArrivals(data.arrivals);
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

  const getMinutesUntil = (stopTime, date) => {
    const now = new Date();
    const arrival = new Date(`${date} ${stopTime}`);
    const diff = Math.round((arrival - now) / 60000);
    if (diff <= 0) return "Arriving now";
    if (diff === 1) return "1 min";
    return `${diff} mins`;
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

      // Fetch the route shape
      try {
        const response = await fetch(
          `http://localhost:3001/api/shape/${bus.shape}`,
        );
        const data = await response.json();
        if (data.shape) setBusShape(data.shape);
      } catch (_err) {
        // Shape is optional, don't show error if it fails
      }

      // Fetch the trip stops
      try {
        const response = await fetch(
          `http://localhost:3001/api/trip/${bus.trip}/stops`,
        );
        const data = await response.json();
        if (data.stops) setTripStops(data.stops);
      } catch (_err) {
        // Trip stops are optional, don't show error if it fails
      }
    } else {
      setError("No live location available for this bus.");
    }
  };

  return (
    <div>
      <h1>DaBus</h1>

      {/* Search by stop number */}
      <div>
        <h2>Search by Stop Number</h2>
        <input
          type="number"
          placeholder="Enter stop number"
          value={stopNumber}
          onChange={(e) => setStopNumber(e.target.value)}
        />
        <button onClick={() => fetchArrivals()}>Get Arrivals</button>
      </div>

      {/* Search by address */}
      <div>
        <h2>Search by Address</h2>
        <input
          type="text"
          placeholder="Enter a street address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button onClick={searchByAddress}>Find Nearby Stops</button>
      </div>

      {searchingAddress && <p>Searching...</p>}
      {loading && <p>Loading arrivals...</p>}
      {error && <p>{error}</p>}

      {/* Nearby stops list */}
      {nearbyStops && (
        <div>
          <h2>Nearby Stops</h2>
          {nearbyStops.length === 0 && <p>No stops found within 0.25 miles.</p>}
          {nearbyStops.map((stop) => (
            <div
              key={stop.stop_id}
              onClick={() => fetchArrivals(stop.stop_id)}
              style={{
                cursor: "pointer",
                padding: "8px",
                borderBottom: "1px solid #ccc",
              }}
            >
              <strong>
                {stop.stop_name
                  .toLowerCase()
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </strong>
              <span>
                {" "}
                — Stop #{stop.stop_id} — {stop.distance.toFixed(2)} mi away
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Arrivals list */}
      {arrivals && (
        <div>
          <h2>Arrivals</h2>
          {arrivals.map((bus) => (
            <div key={bus.id}>
              <p>
                Route {bus.route} — {bus.headsign} — {bus.direction}
              </p>
              <p>
                {bus.estimated === "1" ? "🟢 Live" : "🕐 Scheduled"} —{" "}
                {bus.stopTime} ({getMinutesUntil(bus.stopTime, bus.date)})
              </p>
              {bus.estimated === "1" && <p>Bus #{bus.vehicle}</p>}
              {bus.estimated === "1" && (
                <button onClick={() => fetchBusLocation(bus)}>
                  {selectedBus?.id === bus.id ? "Hide Map" : "Show on Map"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bus location map */}
      {busLocation && (
        <div style={{ height: "400px", marginTop: "16px" }}>
          <h2>
            Bus Location — Route {selectedBus.route} {selectedBus.headsign}
          </h2>
          <button onClick={() => setSatelliteView(!satelliteView)}>
            {satelliteView ? "Switch to Map" : "Switch to Satellite"}
          </button>
          <MapContainer
            center={[
              parseFloat(busLocation.latitude),
              parseFloat(busLocation.longitude),
            ]}
            zoom={15}
            style={{ height: "350px", width: "100%" }}
          >
            {satelliteView ? (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri"
              />
            ) : (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
            )}
            <Marker
              position={[
                parseFloat(busLocation.latitude),
                parseFloat(busLocation.longitude),
              ]}
            >
              <Popup>
                Route {selectedBus.route} — {selectedBus.headsign}
                <br />
                Bus #{busLocation.number}
                <br />
                {busLocation.adherence > 0
                  ? `${busLocation.adherence} min early`
                  : busLocation.adherence < 0
                    ? `${Math.abs(busLocation.adherence)} min late`
                    : "On time"}
              </Popup>
            </Marker>
            {busShape && (
              <Polyline
                positions={busShape}
                color="blue"
                weight={3}
                opacity={0.7}
              />
            )}
            {tripStops &&
              tripStops.map((stop) => (
                <Marker
                  key={stop.stop_id}
                  position={[stop.stop_lat, stop.stop_lon]}
                  icon={L.divIcon({
                    className: "",
                    html: `<div style="
                      width: 10px;
                      height: 10px;
                      background: white;
                      border: 2px solid blue;
                      border-radius: 50%;
                    "></div>`,
                    iconSize: [10, 10],
                    iconAnchor: [5, 5],
                  })}
                >
                  <Popup>
                    <strong>
                      {stop.stop_name
                        .toLowerCase()
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </strong>
                    <br />
                    Stop #{stop.stop_id}
                    <br />
                    {stop.arrival_time}
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}

export default App;
