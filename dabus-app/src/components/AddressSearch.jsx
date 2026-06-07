import { createPortal } from "react-dom";
import { useRef, useEffect, useState } from "react";
import styles from "./AddressSearch.module.css";
import SearchInput from "./SearchInput";
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

  const handleChange = (value) => {
    setQuery(value);
    if (value === "") onClear();
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <SearchInput
        value={query}
        onChange={handleChange}
        placeholder="Stop number or street name"
        onClear={onClear}
        onSubmit={onSearch}
      />

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
            role="listbox"
            aria-label="Stop search results"
          >
            {nearbyStops.map((stop) => (
              <button
                key={stop.stop_id}
                type="button"
                className="dabus-result-item"
                onMouseDown={(e) => { e.preventDefault(); onSelectStop(stop.stop_id); }}
                onTouchEnd={(e) => { e.preventDefault(); onSelectStop(stop.stop_id); }}
                role="option"
                aria-selected="false"
              >
                <div className="dabus-stop-name">
                  {stop.stop_name
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </div>
                <div className="dabus-stop-id">Stop #{stop.stop_id}</div>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default AddressSearch;
