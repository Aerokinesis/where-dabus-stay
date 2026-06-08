import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import { useState } from "react";
import L from "leaflet";
import styles from "./BusTrackingMap.module.css";
import MapRecenterControl from "./MapRecenterControl";
import MapFab from "./MapFab";

function MapMoveTracker({ onMapMove }) {
  useMapEvents({ moveend: (e) => onMapMove(e.target.getCenter()) });
  return null;
}

function BusTrackingMap({ busLocation, userLocation, selectedBus, busShape, tripStops, onGetArrivals, initialCenter, onMapMove }) {
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
          center={initialCenter || busCenter}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
        >
          {onMapMove && <MapMoveTracker onMapMove={onMapMove} />}
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
            icon={L.divIcon({
              className: "",
              html: `<div style="
                background:#18181B;
                color:#fff;
                padding:6px 12px;
                border-radius:10px;
                border:2px solid #e8b84b;
                font-weight:700;
                font-size:13px;
                white-space:nowrap;
                box-shadow:0 2px 8px rgba(0,0,0,0.6);
                text-align:center;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                line-height:1;
              ">🚌 ${selectedBus.route}</div>`,
              iconSize: [60, 30],
              iconAnchor: [30, 15],
            })}
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
          {userCenter && (
            <Marker
              position={userCenter}
              icon={L.divIcon({
                className: "",
                html: '<div style="width:14px;height:14px;background:#1a6faf;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,0.5);"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7],
              })}
            >
              <Popup>You are here</Popup>
            </Marker>
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
          <MapRecenterControl trigger={busTrigger} center={busCenter} />
          <MapRecenterControl trigger={userTrigger} center={userCenter} />
        </MapContainer>

        <div className={styles.fabStack}>
          {userCenter && (
            <MapFab
              onClick={() => setUserTrigger((t) => t + 1)}
              ariaLabel="Recenter map on your location"
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
            </MapFab>
          )}
          <MapFab
            onClick={() => setBusTrigger((t) => t + 1)}
            ariaLabel="Recenter map on the bus"
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
          </MapFab>
        </div>
      </div>
    </div>
  );
}

export default BusTrackingMap;
