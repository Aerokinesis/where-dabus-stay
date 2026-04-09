import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { useState } from "react";
import L from "leaflet";

function BusTrackingMap({ busLocation, selectedBus, busShape, tripStops, onBack }) {
  const [satelliteView, setSatelliteView] = useState(false);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 1100,        // well above nav (200) and everything else
      display: "flex",
      flexDirection: "column",
      background: "var(--bg)",
    }}>
      {/* Header — rendered first in DOM, always on top within this stacking context */}
      <div style={{
        flexShrink: 0,
        padding: "12px 16px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        zIndex: 501,
        position: "relative",
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--primary)",
            fontSize: "14px",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
          }}
        >
          ← Back to arrivals
        </button>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Route {busLocation.route_short_name} — {busLocation.headsign}
        </p>
        <button
          onClick={() => setSatelliteView(!satelliteView)}
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
            fontSize: "13px",
            padding: "4px 10px",
            cursor: "pointer",
            marginTop: "4px",
          }}
        >
          {satelliteView ? "Map view" : "Satellite view"}
        </button>
      </div>

      {/* Map fills remaining space */}
      <div style={{ flex: 1, height: 0, position: "relative", zIndex: 500 }}>
        <MapContainer
          center={[parseFloat(busLocation.latitude), parseFloat(busLocation.longitude)]}
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
          <Marker position={[parseFloat(busLocation.latitude), parseFloat(busLocation.longitude)]}>
            <Popup>
              Route {selectedBus.route} — {selectedBus.headsign}<br />
              Bus #{busLocation.number}<br />
              {busLocation.adherence > 0
                ? `${busLocation.adherence} min early`
                : busLocation.adherence < 0
                ? `${Math.abs(busLocation.adherence)} min late`
                : "On time"}
            </Popup>
          </Marker>
          {busShape && (
            <Polyline positions={busShape} color="#1a6faf" weight={3} opacity={0.7} />
          )}
          {tripStops && tripStops.map((stop) => (
            <Marker
              key={stop.stop_id}
              position={[stop.stop_lat, stop.stop_lon]}
              icon={L.divIcon({
                className: "",
                html: `<div style="width:10px;height:10px;background:#e8b84b;border:2px solid #0a0a0a;border-radius:50%;"></div>`,
                iconSize: [10, 10],
                iconAnchor: [5, 5],
              })}
            >
              <Popup>
                <strong>
                  {stop.stop_name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </strong><br />
                Stop #{stop.stop_id}<br />
                {stop.arrival_time}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default BusTrackingMap;