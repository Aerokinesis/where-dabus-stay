import L from "leaflet";
import styles from "./RouteMap.module.css";
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import MapRecenterControl from "./MapRecenterControl";
import MapFab from "./MapFab";

// Fit the map to the route's bounding box on mount or when the shape changes.
function FitToRoute({ shape }) {
  const map = useMap();

  useEffect(() => {
    if (!shape || shape.length === 0) return;
    const bounds = L.latLngBounds(shape);
    if (!bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [shape, map]);

  return null;
}

const isFiniteLatLng = (lat, lng) =>
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

function RouteMap({
  shape,
  stops,
  selectedStopId,
  onSelectStop,
  userLocation,
  fullHeight,
}) {
  // Default to Honolulu if no usable shape
  const fallbackCenter = [21.3069, -157.8583];
  const midShape =
    shape && shape.length > 0 ? shape[Math.floor(shape.length / 2)] : null;
  const initialCenter =
    midShape && isFiniteLatLng(midShape[0], midShape[1])
      ? [Number(midShape[0]), Number(midShape[1])]
      : fallbackCenter;

  const userValid =
    userLocation && isFiniteLatLng(userLocation.lat, userLocation.lon);

  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [fitRouteTrigger, setFitRouteTrigger] = useState(0);

  return (
    <div className={fullHeight ? styles.mapWrapperFull : styles.mapWrapper}>
      <MapContainer
        center={initialCenter}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <FitToRoute shape={shape} />

        {shape && shape.length > 0 && (
          <Polyline
            positions={shape.filter(
              (p) => Array.isArray(p) && isFiniteLatLng(p[0], p[1]),
            )}
            color="#1a6faf"
            weight={4}
            opacity={0.75}
          />
        )}

        {userValid && (
          <Marker
            position={[Number(userLocation.lat), Number(userLocation.lon)]}
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

        {stops &&
          stops
            .filter((s) => isFiniteLatLng(s.stop_lat, s.stop_lon))
            .map((stop) => {
            const isSelected = selectedStopId === stop.stop_id;
            const size = isSelected ? 22 : 16;
            const offset = size / 2;
            const fill = isSelected ? "#1a6faf" : "#e8b84b";
            const borderColor = isSelected ? "#ffffff" : "#0a0a0a";
            const borderWidth = isSelected ? 3 : 2;
            return (
              <Marker
                key={stop.stop_id}
                position={[Number(stop.stop_lat), Number(stop.stop_lon)]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="width:${size}px;height:${size}px;background:${fill};border:${borderWidth}px solid ${borderColor};border-radius:50%;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
                  iconSize: [size, size],
                  iconAnchor: [offset, offset],
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
                  <button
                    className={styles.popupBtn}
                    onClick={() => onSelectStop && onSelectStop(stop.stop_id)}
                  >
                    Get Arrivals
                  </button>
                </Popup>
              </Marker>
            );
          })}
        <MapRecenterControl
          trigger={recenterTrigger}
          center={userValid ? [Number(userLocation.lat), Number(userLocation.lon)] : null}
        />
        <MapRecenterControl
          trigger={fitRouteTrigger}
          bounds={shape}
        />
      </MapContainer>

      <div className={styles.fabStack}>
        {userValid && (
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
        {shape && shape.length > 0 && (
          <MapFab
            onClick={() => setFitRouteTrigger((t) => t + 1)}
            ariaLabel="Fit map to the whole route"
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
              <polyline points="4 8 4 4 8 4" />
              <polyline points="16 4 20 4 20 8" />
              <polyline points="4 16 4 20 8 20" />
              <polyline points="16 20 20 20 20 16" />
            </svg>
          </MapFab>
        )}
      </div>
    </div>
  );
}

export default RouteMap;
