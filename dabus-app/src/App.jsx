import { useState } from "react";

function App() {
  const [stopNumber, setStopNumber] = useState("");
  const [arrivals, setArrivals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [address, setAddress] = useState("");
  const [nearbyStops, setNearbyStops] = useState(null);
  const [searchingAddress, setSearchingAddress] = useState(false);

  const fetchArrivals = async (stop) => {
    setLoading(true);
    setError(null);
    setNearbyStops(null);

    const stopToFetch = stop || stopNumber;
    const url = `http://localhost:3001/api/arrivals?stop=${stopToFetch}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      setArrivals(data.arrivals);
    } catch (_err) {
      setError(
        "Could not fetch arrivals. Check your stop number and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const searchByAddress = async () => {
    setSearchingAddress(true);
    setError(null);
    setArrivals(null);
    setNearbyStops(null);

    const url = `http://localhost:3001/api/nearby-stops?address=${encodeURIComponent(address)}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setNearbyStops(data.stops);
      }
    } catch (_err) {
      setError("Could not search for nearby stops. Try again.");
    } finally {
      setSearchingAddress(false);
    }
  };

  const getMinutesUntil = (stopTime, date) => {
    const now = new Date();
    const arrival = new Date(`${date} ${stopTime}`);
    const diff = Math.round((arrival - now) / 60000);
    if (diff <= 0) return "Arriving now";
    if (diff === 1) return "1 min";
    return `${diff} mins`;
  };

  return (
    <div>
      <h1>DaBus</h1>

      {/* Search by stop number */}
      <div>
        <h2>Search by Stop Number</h2>
        <input
          type="number"
          placeholder="Enter stop number"
          value={stopNumber}
          onChange={(e) => setStopNumber(e.target.value)}
        />
        <button onClick={() => fetchArrivals()}>Get Arrivals</button>
      </div>

      {/* Search by address */}
      <div>
        <h2>Search by Address</h2>
        <input
          type="text"
          placeholder="Enter a street address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button onClick={searchByAddress}>Find Nearby Stops</button>
      </div>

      {searchingAddress && <p>Searching...</p>}
      {loading && <p>Loading arrivals...</p>}
      {error && <p>{error}</p>}

      {/* Nearby stops list */}
      {nearbyStops && (
        <div>
          <h2>Nearby Stops</h2>
          {nearbyStops.length === 0 && <p>No stops found within 0.25 miles.</p>}
          {nearbyStops.map((stop) => (
            <div
              key={stop.stop_id}
              onClick={() => fetchArrivals(stop.stop_id)}
              style={{
                cursor: "pointer",
                padding: "8px",
                borderBottom: "1px solid #ccc",
              }}
            >
              <strong>
                {stop.stop_name
                  .toLowerCase()
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </strong>
              <span>
                {" "}
                — Stop #{stop.stop_id} — {stop.distance.toFixed(2)} mi away
              </span>
            </div>
          ))}
        </div>
      )}


      {/* Arrivals list */}
      {arrivals && (
        <div>
          <h2>Arrivals</h2>
          {arrivals.map((bus) => (
            <div key={bus.id}>
              <p>
                Route {bus.route} — {bus.headsign}
              </p>
              <p>
                {bus.estimated === "1" ? "🟢 Live" : "🕐 Scheduled"} —{" "}
                {bus.stopTime} ({getMinutesUntil(bus.stopTime, bus.date)})
              </p>
              {bus.estimated === "1" && <p>Bus #{bus.vehicle}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
