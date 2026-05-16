import L from "leaflet";
import styles from "./NearbyStopsMap.module.css";
import { useEffect, useRef } from "react";
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
      </MapContainer>
    </div>
  );
}

export default NearbyStopsMap;
