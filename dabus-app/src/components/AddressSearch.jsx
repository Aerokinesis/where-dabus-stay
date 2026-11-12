import { createPortal } from "react-dom";
import { useRef, useEffect, useState } from "react";
import styles from "./AddressSearch.module.css";
import SearchInput from "./SearchInput";
import "../dabus-portal.css";

// How many recent stops show inline before "See all" takes over.
const RECENT_PREVIEW_COUNT = 5;

// Gap between the search bar and the results/recents dropdown below it.
const DROPDOWN_GAP = 6;

// How long typing must pause before the street-name search runs.
const TYPE_PAUSE_MS = 250;

function AddressSearch({
  query,
  setQuery,
  onSearch,
  // Called with the trimmed text once typing pauses (optional; without it the
  // search only runs on Enter).
  onType,
  onClear,
  searching,
  nearbyStops,
  onSelectStop,
  // Recent-stops dropdown (shown when the field is focused and empty, before
  // any address search has run — see the "Recents in Search" prototype).
  // `recentStops` is the full history list ({ stopId, stopName }[]); this
  // component caps the inline preview itself and hands off to
  // `onSeeAllRecent` for the rest. Both are optional — omit them and this
  // component behaves exactly as it did before recents moved here.
  recentStops,
  onSeeAllRecent,
}) {
  const containerRef = useRef(null);
  const resultsRef = useRef(null);
  const [portalStyle, setPortalStyle] = useState({});
  const [focused, setFocused] = useState(false);
  // Tracks touch movement on result rows so a scroll gesture isn't mistaken
  // for a tap on touchend (see onTouchStart/Move/End below).
  const touchStateRef = useRef({ startY: 0, scrolled: false });

  const hasMatches = Boolean(nearbyStops && nearbyStops.length > 0);
  // Recents only show before any address search has been submitted
  // (nearbyStops is null until searchByAddress runs) and only while the
  // field is empty and focused — typing or a submitted search takes over.
  const showRecent = Boolean(
    !nearbyStops &&
      focused &&
      query.trim() === "" &&
      recentStops &&
      recentStops.length > 0,
  );
  const dropdownOpen = hasMatches || showRecent;
  const previewRecent = showRecent ? recentStops.slice(0, RECENT_PREVIEW_COUNT) : [];
  const hasMoreRecent = showRecent && recentStops.length > previewRecent.length;

  useEffect(() => {
    if (!((hasMatches || showRecent) && containerRef.current)) return;

    const updatePosition = () => {
      const rect = containerRef.current.getBoundingClientRect();
      // Use visualViewport when available so the dropdown's max height
      // shrinks to the space actually visible above the on-screen keyboard,
      // instead of 60vh (full layout viewport) which extends underneath it.
      const viewportHeight = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      // Small gap below the search bar instead of sitting flush against it
      // (matches the "Recents in Search" prototype).
      const top = rect.bottom + DROPDOWN_GAP;
      const availableHeight = Math.max(viewportHeight - top - 8, 120);
      setPortalStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${availableHeight}px`,
      });
    };

    updatePosition();
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [hasMatches, showRecent]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedInsideContainer = containerRef.current?.contains(e.target);
      const clickedInsideResults = resultsRef.current?.contains(e.target);
      if (clickedInsideContainer || clickedInsideResults) return;
      // Real search results get dismissed through the parent's onClear, same
      // as always. The recents dropdown has nothing to clear — a submitted
      // query — so it just closes locally. (A search that finds nothing shows
      // the app's error message instead of a dropdown.)
      if (hasMatches) onClear();
      else if (showRecent) setFocused(false);
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen, hasMatches, showRecent, onClear]);

  // Search-as-you-type: the text is handed to onType once typing pauses.
  // The search is skipped if the field no longer holds that text by then:
  // the parent changes it when a stop is opened some other way (a tap on the
  // map, the other search bar), and the list must not reopen after that.
  const typeTimer = useRef(null);
  const cancelTypedSearch = () => clearTimeout(typeTimer.current);
  useEffect(() => cancelTypedSearch, []);
  const latestQuery = useRef(query);
  useEffect(() => {
    latestQuery.current = query;
  }, [query]);

  const handleChange = (value) => {
    setQuery(value);
    cancelTypedSearch();
    const q = value.trim();
    if (value === "") onClear();
    else if (onType && q)
      typeTimer.current = setTimeout(() => {
        if (latestQuery.current === value) onType(q);
      }, TYPE_PAUSE_MS);
  };

  // Anything that settles the search drops a typed search still waiting, so
  // it can't reopen the list afterwards.
  const handleSubmit = () => {
    cancelTypedSearch();
    onSearch();
  };
  const handleClear = () => {
    cancelTypedSearch();
    onClear();
  };
  const selectStop = (stopId) => {
    cancelTypedSearch();
    onSelectStop(stopId);
  };

  const selectRecent = (stopId) => {
    setFocused(false);
    selectStop(stopId);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <SearchInput
        value={query}
        onChange={handleChange}
        placeholder="Stop number or street name"
        onClear={handleClear}
        onSubmit={handleSubmit}
        onFocus={() => setFocused(true)}
      />

      {searching && <p className={styles.status}>Searching...</p>}

      {hasMatches &&
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
                onMouseDown={(e) => { e.preventDefault(); selectStop(stop.stop_id); }}
                onClick={(e) => {
                  // Keyboard Enter/Space dispatches click with detail 0; mouse
                  // taps were already handled by onMouseDown above (detail > 0).
                  if (e.detail === 0) selectStop(stop.stop_id);
                }}
                onTouchStart={(e) => {
                  touchStateRef.current = { startY: e.touches[0].clientY, scrolled: false };
                }}
                onTouchMove={(e) => {
                  const dy = Math.abs(e.touches[0].clientY - touchStateRef.current.startY);
                  if (dy > 10) touchStateRef.current.scrolled = true;
                }}
                onTouchEnd={(e) => {
                  // Finger moved more than a few px — this was a scroll, not a tap.
                  // Let it pass through so the list keeps scrolling normally.
                  if (touchStateRef.current.scrolled) return;
                  e.preventDefault();
                  selectStop(stop.stop_id);
                }}
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

      {showRecent &&
        createPortal(
          <div
            className="dabus-results"
            ref={resultsRef}
            style={portalStyle}
            role="listbox"
            aria-label="Recent stops"
          >
            <div className="dabus-results-label">Recent</div>
            {previewRecent.map((entry) => (
              <button
                key={entry.stopId}
                type="button"
                className="dabus-result-item"
                onMouseDown={(e) => { e.preventDefault(); selectRecent(entry.stopId); }}
                onClick={(e) => {
                  if (e.detail === 0) selectRecent(entry.stopId);
                }}
                onTouchStart={(e) => {
                  touchStateRef.current = { startY: e.touches[0].clientY, scrolled: false };
                }}
                onTouchMove={(e) => {
                  const dy = Math.abs(e.touches[0].clientY - touchStateRef.current.startY);
                  if (dy > 10) touchStateRef.current.scrolled = true;
                }}
                onTouchEnd={(e) => {
                  if (touchStateRef.current.scrolled) return;
                  e.preventDefault();
                  selectRecent(entry.stopId);
                }}
                role="option"
                aria-selected="false"
              >
                <div className="dabus-stop-name">
                  {entry.stopName
                    ? entry.stopName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
                    : `Stop #${entry.stopId}`}
                </div>
                <div className="dabus-stop-id">Stop #{entry.stopId}</div>
              </button>
            ))}
            {hasMoreRecent && onSeeAllRecent && (
              <button
                type="button"
                className="dabus-result-more"
                onMouseDown={(e) => { e.preventDefault(); setFocused(false); onSeeAllRecent(); }}
                onClick={(e) => {
                  if (e.detail === 0) { setFocused(false); onSeeAllRecent(); }
                }}
              >
                See all {recentStops.length} recent stops
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default AddressSearch;
