import L from "leaflet";
import styles from "./NearbyStopsMap.module.css";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";

function MapMoveTracker({ onMapMove }) {
  useMapEvents({
    moveend: (e) => onMapMove(e.target.getCenter()),
  });
  return null;
}

function MapRecenter({ center }) {
  const map = useMap();
  const hasSet = useRef(false);

  useEffect(() => {
    if (center && !hasSet.current) {
      map.setView(center);
      hasSet.current = true;
    }
  }, [center]);

  return null;
}

// Listens for the FAB's trigger counter and flies the map to the user.
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

function NearbyStopsMap({
  userLocation,
  nearbyStopsMap,
  onSelectStop,
  onMount,
  mapCenter,
  onMapMove,
  fullHeight,
  searchRadius = 0.25,
}) {
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  useEffect(() => {
    if (onMount) onMount();
  }, []);

  const defaultCenter = [21.3069, -157.8583];
  const initialCenter = mapCenter
    ? [mapCenter.lat, mapCenter.lng]
    : userLocation
      ? [userLocation.lat, userLocation.lon]
      : defaultCenter;


  return (
    <div className={fullHeight ? styles.mapWrapperFull : styles.mapWrapper}>
      <MapContainer
        center={initialCenter}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <MapMoveTracker onMapMove={onMapMove} />
        {!mapCenter && userLocation && (
          <MapRecenter center={[userLocation.lat, userLocation.lon]} />
        )}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lon]}>
              <Popup>You are here</Popup>
            </Marker>

            <Circle
              center={[userLocation.lat, userLocation.lon]}
              radius={searchRadius * 1609.34}
              pathOptions={{
                color: "#1a6faf",
                fillColor: "#1a6faf",
                fillOpacity: 0.1,
              }}
            />
          </>
        )}
        {nearbyStopsMap &&
          nearbyStopsMap.map((stop) => (
            <Marker
              key={stop.stop_id}
              position={[parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)]}
              icon={L.divIcon({
                className: "",
                html: `<div style="width:16px;height:16px;background:#e8b84b;border:2px solid #0a0a0a;border-radius:50%;cursor:pointer;"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            >
              <Popup>
                <strong>
                  {stop.stop_name
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </strong>
                <br />
                Stop #{stop.stop_id} — {stop.distance.toFixed(2)} mi away
                <br />
                <button
                  className={styles.popupBtn}
                  onClick={() => onSelectStop(stop.stop_id)}
                >
                  Get Arrivals
                </button>
              </Popup>
            </Marker>
          ))}
        <RecenterControl
          trigger={recenterTrigger}
          center={userLocation ? [userLocation.lat, userLocation.lon] : null}
        />
      </MapContainer>

      {userLocation && (
        <button
          type="button"
          className={styles.recenterFab}
          onClick={() => setRecenterTrigger((t) => t + 1)}
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
    </div>
  );
}

export default NearbyStopsMap;
