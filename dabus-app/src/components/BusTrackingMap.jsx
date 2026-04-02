import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet"
import { useState } from "react"
import L from "leaflet"

function BusTrackingMap({ busLocation, selectedBus, busShape, tripStops }) {
  const [satelliteView, setSatelliteView] = useState(false)

  return (
    <div style={{ height: "400px", marginTop: "16px" }}>
      <h2>Bus Location — Route {selectedBus.route} {selectedBus.headsign}</h2>
      <button onClick={() => setSatelliteView(!satelliteView)}>
        {satelliteView ? "Switch to Map" : "Switch to Satellite"}
      </button>
      <MapContainer
        center={[parseFloat(busLocation.latitude), parseFloat(busLocation.longitude)]}
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
          <Polyline positions={busShape} color="blue" weight={3} opacity={0.7} />
        )}
        {tripStops && tripStops.map((stop) => (
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
                {stop.stop_name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </strong><br />
              Stop #{stop.stop_id}<br />
              {stop.arrival_time}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default BusTrackingMap