function AddressSearch({ query, setQuery, onSearch, searching, nearbyStops, onSelectStop }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div>
      <h2>Find a Stop</h2>
      <input
        type="text"
        placeholder="Stop number or street name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button onClick={onSearch}>Search</button>
      {searching && <p>Searching...</p>}
      {nearbyStops && nearbyStops.length === 0 && <p>No stops found.</p>}
      {nearbyStops && nearbyStops.length > 0 && (
        <div>
          {nearbyStops.map((stop) => (
            <div
              key={stop.stop_id}
              onClick={() => onSelectStop(stop.stop_id)}
              style={{ cursor: "pointer", padding: "8px", borderBottom: "1px solid #ccc" }}
            >
              <strong>
                {stop.stop_name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </strong>
              <span> — Stop #{stop.stop_id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AddressSearch;