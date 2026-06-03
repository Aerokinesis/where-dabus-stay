import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import { useState, useEffect } from "react";
import L from "leaflet";
import styles from "./BusTrackingMap.module.css";

// Listens for a trigger counter and flies the map to the given center.
function RecenterControl({ trigger, center }) {
  const map = useMap();

  useEffect(() => {
    // trigger starts at 0 and only increments on FAB click, so this naturally
    // skips both the initial mount and StrictMode's simulated remount in dev.
    if (trigger === 0) return;
    if (!Array.isArray(center)) return;
    const [lat, lng] = center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [trigger]);

  return null;
}

function BusTrackingMap({ busLocation, userLocation, selectedBus, busShape, tripStops, onGetArrivals }) {
  const [satelliteView, setSatelliteView] = useState(false);
  const [busTrigger, setBusTrigger] = useState(0);
  const [userTrigger, setUserTrigger] = useState(0);

  const busCenter = [
    parseFloat(busLocation.latitude),
    parseFloat(busLocation.longitude),
  ];
  const userCenter = userLocation
    ? [userLocation.lat, userLocation.lon]
    : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flexShrink: 0,
          padding: "8px 16px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setSatelliteView(!satelliteView)}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
            fontSize: "13px",
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          {satelliteView ? "Map view" : "Satellite view"}
        </button>
      </div>
      <div className={styles.mapWrapper}>
        <MapContainer
          center={[
            parseFloat(busLocation.latitude),
            parseFloat(busLocation.longitude),
          ]}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
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
              color="#1a6faf"
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
                  html: `<div style="width:16px;height:16px;background:#e8b84b;border:2px solid #0a0a0a;border-radius:50%;"></div>`,
                  iconSize: [16, 16],
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
                  <br />
                  <button
                    onClick={() => onGetArrivals(stop.stop_id)}
                    style={{
                      marginTop: "6px",
                      background: "#1a6faf",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "12px",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    Get Arrivals
                  </button>
                </Popup>
              </Marker>
            ))}
          <RecenterControl trigger={busTrigger} center={busCenter} />
          <RecenterControl trigger={userTrigger} center={userCenter} />
        </MapContainer>

        <div className={styles.fabStack}>
          {userCenter && (
            <button
              type="button"
              className={styles.fab}
              onClick={() => setUserTrigger((t) => t + 1)}
              aria-label="Recenter map on your location"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className={styles.fab}
            onClick={() => setBusTrigger((t) => t + 1)}
            aria-label="Recenter map on the bus"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 18V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10" />
              <path d="M4 12h16" />
              <circle cx="8" cy="18" r="1.5" />
              <circle cx="16" cy="18" r="1.5" />
              <path d="M6 6V4h12v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BusTrackingMap;
