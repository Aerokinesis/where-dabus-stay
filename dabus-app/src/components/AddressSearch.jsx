import { createPortal } from "react-dom";
import { useRef, useEffect, useState } from "react";
import styles from "./AddressSearch.module.css";
import "../dabus-portal.css";

function AddressSearch({
  query,
  setQuery,
  onSearch,
  onClear,
  searching,
  nearbyStops,
  onSelectStop,
}) {
  const containerRef = useRef(null);
  const resultsRef = useRef(null);
  const [portalStyle, setPortalStyle] = useState({});

  useEffect(() => {
    if (nearbyStops && nearbyStops.length > 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPortalStyle({
        position: "fixed",
        top: `${rect.bottom}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      });
    }
  }, [nearbyStops]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedInsideContainer = containerRef.current?.contains(e.target);
      const clickedInsideResults = resultsRef.current?.contains(e.target);
      if (!clickedInsideContainer && !clickedInsideResults) {
        onClear();
      }
    };

    if (nearbyStops && nearbyStops.length > 0) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [nearbyStops]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.inputRow}>
        <svg
          className={styles.icon}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className={styles.input}
          type="text"
          placeholder="Stop number or street name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value === "") onClear();
          }}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button className={styles.clearBtn} onClick={onClear}>
            ✕
          </button>
        )}
      </div>

      {searching && <p className={styles.status}>Searching...</p>}
      {nearbyStops && nearbyStops.length === 0 && (
        <p className={styles.status}>No stops found.</p>
      )}
      {nearbyStops &&
        nearbyStops.length > 0 &&
        createPortal(
          <div
            className="dabus-results"
            ref={resultsRef}
            style={portalStyle}
          >
            {nearbyStops.map((stop) => (
              <div
                key={stop.stop_id}
                className="dabus-result-item"
                onClick={() => onSelectStop(stop.stop_id)}
              >
                <div className="dabus-stop-name">
                  {stop.stop_name
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </div>
                <div className="dabus-stop-id">Stop #{stop.stop_id}</div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default AddressSearch;