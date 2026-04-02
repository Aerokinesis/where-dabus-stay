import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet"
import L from "leaflet"

function NearbyStopsMap({ userLocation, nearbyStopsMap, onSelectStop }) {
  return (
    <div>
      {userLocation && nearbyStopsMap && (
        <MapContainer
          center={[userLocation.lat, userLocation.lon]}
          zoom={15}
          style={{ height: "400px", width: "100%", marginTop: "8px" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={[userLocation.lat, userLocation.lon]}>
            <Popup>You are here</Popup>
          </Marker>
          <Circle
            center={[userLocation.lat, userLocation.lon]}
            radius={402}
            pathOptions={{ color: "#1d72b8", fillColor: "#1d72b8", fillOpacity: 0.1 }}
          />
          {nearbyStopsMap.map((stop) => (
            <Marker
              key={stop.stop_id}
              position={[parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)]}
              icon={L.divIcon({
                className: "",
                html: `<div style="
                  width: 12px;
                  height: 12px;
                  background: #1d72b8;
                  border: 2px solid white;
                  border-radius: 50%;
                  cursor: pointer;
                "></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              })}
            >
              <Popup>
                <strong>
                  {stop.stop_name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </strong>
                <br />
                Stop #{stop.stop_id}
                <br />
                {stop.distance.toFixed(2)} mi away
                <br />
                <button onClick={() => onSelectStop(stop.stop_id)}>
                  Get Arrivals
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  )
}

export default NearbyStopsMap