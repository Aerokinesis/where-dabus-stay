import { useEffect, useId, useRef, useState } from "react";

import { API_BASE } from "../constants";
import { stopName } from "../lib/posts";
import styles from "./AdminPage.module.css";

const shortRoutes = (routes, max = 6) =>
  routes.length <= max ? routes.join(", ") : `${routes.slice(0, max).join(", ")} +${routes.length - max}`;

// Stop picker for the post editor: type part of a street name ("beretania
// punchbowl") or a stop number and pick from matches. Stops served by the
// routes already entered in the post rank first and are marked, which is how
// you tell apart the two stops that share an intersection name.
//
// `value` is an array of stop id strings. `info` maps id -> { name, routes }
// for display; the picker adds to it as stops are chosen.
//
// If the stop search is unreachable (Railway down, or a preview domain CORS
// blocks), typing a number and pressing Enter still adds it, as before.
export default function StopPicker({ value, onChange, info, onInfo, routes }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const inputRef = useRef(null);
  const listId = useId();
  const routeKey = routes.join(",");

  // Debounced search. Aborts the previous request so a slow response for
  // "ber" can't overwrite the results for "beretania".
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const params = new URLSearchParams({ q });
        if (routeKey) params.set("routes", routeKey);
        const res = await fetch(`${API_BASE}/api/stops/suggest?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setResults(data.stops || []);
        setActive(0);
        setStatus("ready");
      } catch (e) {
        if (e.name !== "AbortError") {
          setResults([]);
          setStatus("error");
        }
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, routeKey]);

  const add = (stop) => {
    if (!value.includes(stop.stop_id)) onChange([...value, stop.stop_id]);
    onInfo({ [stop.stop_id]: { name: stop.stop_name, routes: stop.routes || [] } });
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  // "45, 4860" or "45 4860" + Enter adds each number directly.
  const addTyped = () => {
    const ids = query.split(/[\s,]+/).filter((s) => /^\d{1,6}$/.test(s));
    if (ids.length === 0) return false;
    onChange([...new Set([...value, ...ids])]);
    setQuery("");
    setResults([]);
    setOpen(false);
    // Fill in names for the chips; harmless if the lookup fails.
    fetch(`${API_BASE}/api/stops/lookup?ids=${ids.join(",")}`)
      .then((r) => (r.ok ? r.json() : { stops: [] }))
      .then((d) => {
        const more = {};
        for (const s of d.stops || [])
          more[s.stop_id] = s.stop_name ? { name: s.stop_name, routes: s.routes } : { missing: true };
        onInfo(more);
      })
      .catch(() => {});
    return true;
  };

  const remove = (id) => onChange(value.filter((v) => v !== id));

  const onKeyDown = (e) => {
    const showing = open && query.trim() && results.length > 0;
    if (e.key === "ArrowDown" && showing) {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && showing) {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the whole form from this field
      // A typed number (or list of numbers) wins over whatever is highlighted,
      // so "45" + Enter always adds stop 45.
      if (/^[\d\s,]+$/.test(query.trim()) && addTyped()) return;
      if (showing) add(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const wanted = new Set(routes);
  const showList = open && query.trim().length > 0;

  return (
    <div className={styles.stopPicker}>
      {value.length > 0 && (
        <ul className={styles.stopChips} aria-label="Selected stops">
          {value.map((id) => (
            <li key={id} className={`${styles.stopChip} ${info[id]?.missing ? styles.stopChipMissing : ""}`}>
              <span className={styles.stopChipNum}>#{id}</span>
              <span className={styles.stopChipName}>
                {info[id]?.missing
                  ? "No stop with this number — check for a typo"
                  : stopName(info[id]?.name) || "…"}
              </span>
              <button type="button" onClick={() => remove(id)} aria-label={`Remove stop ${id}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.comboWrap}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Add a stop"
          placeholder={value.length ? "Add another stop" : "Street names or stop number, e.g. beretania punchbowl"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />

        {showList && (
          <div className={styles.comboPanel}>
            {status === "error" ? (
              <p className={styles.comboNote}>
                Can't search stops right now. Type a stop number and press Enter to add it.
              </p>
            ) : results.length === 0 ? (
              <p className={styles.comboNote}>{status === "loading" ? "Searching…" : "No matching stops."}</p>
            ) : (
              <ul id={listId} role="listbox" className={styles.comboList}>
                {results.map((s, i) => {
                  const picked = value.includes(s.stop_id);
                  const matching = s.routes.filter((r) => wanted.has(r));
                  return (
                    <li
                      key={s.stop_id}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      aria-disabled={picked}
                      className={`${styles.comboOption} ${i === active ? styles.comboActive : ""} ${picked ? styles.comboPicked : ""}`}
                      onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                      onMouseEnter={() => setActive(i)}
                      onClick={() => !picked && add(s)}
                    >
                      <span className={styles.comboNum}>#{s.stop_id}</span>
                      <span className={styles.comboText}>
                        <span className={styles.comboName}>{stopName(s.stop_name)}</span>
                        <span className={styles.comboRoutes}>
                          {matching.length > 0 && (
                            <span className={styles.comboOnRoute}>On route {matching.join(", ")}</span>
                          )}
                          {s.routes.length > 0 ? `Routes ${shortRoutes(s.routes)}` : "No scheduled routes"}
                        </span>
                      </span>
                      {picked && <span className={styles.comboAdded}>Added</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
      {routes.length > 0 && (
        <p className={styles.sectionHint}>Stops on route {routes.join(", ")} are listed first.</p>
      )}
    </div>
  );
}
