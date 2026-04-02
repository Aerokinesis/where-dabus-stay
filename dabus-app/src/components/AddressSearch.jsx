function AddressSearch({ address, setAddress, onSearch, searching, nearbyStops, onSelectStop }) {
  return (
    <div>
      <h2>Search by Address</h2>
      <input
        type="text"
        placeholder="Enter a street address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <button onClick={onSearch}>Find Nearby Stops</button>
      {searching && <p>Searching...</p>}
      {nearbyStops && (
        <div>
          <h2>Nearby Stops</h2>
          {nearbyStops.length === 0 && <p>No stops found within 0.25 miles.</p>}
          {nearbyStops.map((stop) => (
            <div
              key={stop.stop_id}
              onClick={() => onSelectStop(stop.stop_id)}
              style={{ cursor: "pointer", padding: "8px", borderBottom: "1px solid #ccc" }}
            >
              <strong>
                {stop.stop_name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </strong>
              <span> — Stop #{stop.stop_id} — {stop.distance.toFixed(2)} mi away</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AddressSearch