import styles from "./AddressSearch.module.css";

function AddressSearch({ query, setQuery, onSearch, searching, nearbyStops, onSelectStop }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div className={styles.container}>
      <div className={styles.inputRow}>
        <svg className={styles.icon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className={styles.input}
          type="text"
          placeholder="Stop number or street name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button className={styles.clearBtn} onClick={() => setQuery("")}>✕</button>
        )}
      </div>

      {searching && <p className={styles.status}>Searching...</p>}
      {nearbyStops && nearbyStops.length === 0 && (
        <p className={styles.status}>No stops found.</p>
      )}
      {nearbyStops && nearbyStops.length > 0 && (
        <div className={styles.results}>
          {nearbyStops.map((stop) => (
            <div
              key={stop.stop_id}
              className={styles.resultItem}
              onClick={() => onSelectStop(stop.stop_id)}
            >
              <span className={styles.stopName}>
                {stop.stop_name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <span className={styles.stopId}>Stop #{stop.stop_id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AddressSearch;