import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import styles from "./NearbyStopsMap.module.css";

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center]);
  return null;
}

function NearbyStopsMap({ userLocation, nearbyStopsMap, onSelectStop, onMount }) {
  useEffect(() => {
    onMount();
  }, []);

  const defaultCenter = [21.3069, -157.8583];
  const center = userLocation
    ? [userLocation.lat, userLocation.lon]
    : defaultCenter;

  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <MapRecenter center={center} />
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
              radius={402}
              pathOptions={{ color: "#1a6faf", fillColor: "#1a6faf", fillOpacity: 0.1 }}
            />
          </>
        )}
        {nearbyStopsMap && nearbyStopsMap.map((stop) => (
          <Marker
            key={stop.stop_id}
            position={[parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)]}
            icon={L.divIcon({
              className: "",
              html: `<div style="width:12px;height:12px;background:#e8b84b;border:2px solid #0a0a0a;border-radius:50%;cursor:pointer;"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            })}
          >
            <Popup>
              <strong>
                {stop.stop_name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </strong>
              <br />
              Stop #{stop.stop_id} — {stop.distance.toFixed(2)} mi away
              <br />
              <button className={styles.popupBtn} onClick={() => onSelectStop(stop.stop_id)}>
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