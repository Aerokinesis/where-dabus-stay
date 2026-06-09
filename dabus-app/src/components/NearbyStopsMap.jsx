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
import MapRecenterControl from "./MapRecenterControl";
import MapFab from "./MapFab";

function MapMoveTracker({ onMapMove }) {
  const lastCenter = useRef(null);
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      if (
        !lastCenter.current ||
        Math.abs(c.lat - lastCenter.current.lat) > 0.00001 ||
        Math.abs(c.lng - lastCenter.current.lng) > 0.00001
      ) {
        lastCenter.current = c;
        onMapMove(c);
      }
    },
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

function NearbyStopsMap({
  userLocation,
  nearbyStopsMap,
  onSelectStop,
  onMount,
  mapCenter,
  onMapMove,
  fullHeight,
  searchRadius = 0.25,
  onRefreshLocation,
  locating = false,
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
            <Marker position={[userLocation.lat, userLocation.lon]} zIndexOffset={-1000}>
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
                html: stop.bearing != null
                  ? `<div style="width:20px;height:28px;transform:rotate(${stop.bearing}deg);transform-origin:10px 21px;">
                       <svg width="20" height="28" viewBox="0 0 20 28" xmlns="http://www.w3.org/2000/svg">
                         <polygon points="10,2 15,11 5,11" fill="#e8b84b" stroke="#1a1a1a" stroke-width="1.5" stroke-linejoin="round"/>
                         <circle cx="10" cy="21" r="7" fill="#e8b84b" stroke="#1a1a1a" stroke-width="2"/>
                       </svg>
                     </div>`
                  : `<div style="width:16px;height:16px;background:#e8b84b;border:2px solid #1a1a1a;border-radius:50%;cursor:pointer;"></div>`,
                iconSize: stop.bearing != null ? [20, 28] : [16, 16],
                iconAnchor: stop.bearing != null ? [10, 21] : [8, 8],
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
        <MapRecenterControl
          trigger={recenterTrigger}
          center={userLocation ? [userLocation.lat, userLocation.lon] : null}
        />
      </MapContainer>

      {userLocation && Array.isArray(nearbyStopsMap) && nearbyStopsMap.length === 0 && (
        <div className={styles.noStopsBanner}>
          No stops found nearby — TheBus only serves Oahu, Hawaiʻi
        </div>
      )}

      <div className={styles.fabStack}>
        {onRefreshLocation && (
          <MapFab
            onClick={onRefreshLocation}
            ariaLabel="Refresh my location"
            disabled={locating}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={locating ? { animation: "spin 1s linear infinite" } : undefined}
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </MapFab>
        )}
        {userLocation && (
          <MapFab
            onClick={() => setRecenterTrigger((t) => t + 1)}
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
      </div>
    </div>
  );
}

export default NearbyStopsMap;
