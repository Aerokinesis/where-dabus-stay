import { useState, useEffect, useRef } from "react";
import styles from "./App.module.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import NearbyStopsMap from "./components/NearbyStopsMap";
import AddressSearch from "./components/AddressSearch";
import ArrivalsList from "./components/ArrivalsList";
import BusTrackingMap from "./components/BusTrackingMap";
import ErrorBoundary from "./components/ErrorBoundary";
import Favorites from "./components/Favorites";
import SaveStopModal from "./components/SaveStopModal";
import StopHistory from "./components/StopHistory";
import RoutesTab from "./components/RoutesTab";
import RouteMap from "./components/RouteMap";
import SettingsTab from "./components/SettingsTab";
import Toast from "./components/Toast";
import SearchInput from "./components/SearchInput";
import { useArrivals } from "./hooks/useArrivals";
import { useFavorites } from "./hooks/useFavorites";
import { useNearbyStops } from "./hooks/useNearbyStops";
import { useBusTracking } from "./hooks/useBusTracking";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import PullToRefreshIndicator from "./components/PullToRefreshIndicator";
import { useStopHistory } from "./hooks/useStopHistory";
import { useSettings } from "./hooks/useSettings";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useAlerts } from "./hooks/useAlerts";
import { API_BASE } from "./constants";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function App() {
  // Settings must be first — other hooks depend on settings.searchRadius
  const { settings, updateSetting } = useSettings();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [searchQuery, setSearchQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [activeTab, setActiveTab] = useState("nearby");
  const [trackingView, setTrackingView] = useState(false);
  const [routeMapView, setRouteMapView] = useState(false);
  const [arrivalsTab, setArrivalsTab] = useState(null);
  // Stop IDs previously visited on the nearby tab — used to navigate back.
  const [nearbyStopStack, setNearbyStopStack] = useState([]);
  const [stopSearchQuery, setStopSearchQuery] = useState("");

  // Refs for PWA system-back interception (see useEffects below)
  const backHandlerRef = useRef(null);
  const showToastRef = useRef(null);   // always-current showToast (populated below)
  const isDeepRef = useRef(false);     // always-current isDeep value
  const activeTabRef = useRef("nearby"); // always-current activeTab value
  const exitGuardRef = useRef(false);  // true while "press back again to exit" is active
  const exitTimerRef = useRef(null);

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches
  );

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Toast state
  const [toast, setToast] = useState(null);
  const [toastFading, setToastFading] = useState(false);
  const [toastType, setToastType] = useState("add");

  // Routes state
  const [routes, setRoutes] = useState(null);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeStops, setRouteStops] = useState(null);
  const [routeShape, setRouteShape] = useState(null);
  const [routeStopsLoading, setRouteStopsLoading] = useState(false);

  const {
    arrivals,
    currentStop,
    loading,
    error,
    setError,
    fetchArrivals,
    lastUpdated,
    clearArrivals,
  } = useArrivals();

  const {
    favorites,
    saveToFavorites,
    removeFavorite,
    clearFavorites,
    isCurrentStopFavorited,
  } = useFavorites();

  const {
    nearbyStops,
    nearbyStopsMap,
    userLocation,
    searchingAddress,
    locating,
    searchByAddress,
    findNearbyStops,
    refindNearbyStops,
    clearNearbyStops,
  } = useNearbyStops(setError, settings.searchRadius);

  const {
    selectedBus,
    busLocation,
    busShape,
    tripStops,
    trackingLoading,
    fetchBusLocation,
    clearBusTracking,
  } = useBusTracking(setError);

  const { stopHistory, addToHistory, removeFromHistory, clearHistory } =
    useStopHistory();

  const {
    alertsForRoute,
    dismissedAlertsForRoute,
    dismiss: dismissAlert,
    restore: restoreAlerts,
  } = useAlerts();

  const { isPulling, pullDistance, triggered } = usePullToRefresh(
    () => fetchArrivals(currentStop.id),
    !!arrivals,
  );

  const [mapCenter, setMapCenter] = useState(null);
  const [trackingMapCenter, setTrackingMapCenter] = useState(null);

  // Refetch nearby stops whenever the radius or user's location changes.
  // Runs regardless of active tab so changes from Settings take effect before
  // the user navigates back to Home.
  // Keep the stop search bar in sync with whatever stop is currently loaded.
  useEffect(() => {
    setStopSearchQuery(currentStop ? String(currentStop.id) : "");
  }, [currentStop]);

  // Seed trackingMapCenter when a bus is first tracked; clear it when tracking ends.
  // Only seed when null so user panning during a session is preserved on remount.
  useEffect(() => {
    if (busLocation && !trackingMapCenter) {
      setTrackingMapCenter([
        parseFloat(busLocation.latitude),
        parseFloat(busLocation.longitude),
      ]);
    }
    if (!busLocation) {
      setTrackingMapCenter(null);
    }
  }, [busLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed mapCenter from userLocation the first time we get a fix so the map
  // never resets to the user's position on remount (Leaflet doesn't fire
  // moveend when setView is called with the same coordinates, so we can't rely
  // on the MapRecenter component to populate mapCenter).
  useEffect(() => {
    if (userLocation && !mapCenter) {
      setMapCenter({ lat: userLocation.lat, lng: userLocation.lon });
    }
  }, [userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (userLocation) {
      refindNearbyStops(
        userLocation.lat,
        userLocation.lon,
        settings.searchRadius,
      );
    }
  }, [settings.searchRadius, userLocation, refindNearbyStops]);

  // Fetch routes list when routes tab is first opened. The guard inside the
  // effect prevents duplicate fetches; depending on routes/routesLoading here
  // would risk a refetch loop on persistent failure, so they're intentionally
  // omitted from the dep array.
  useEffect(() => {
    if (activeTab === "routes" && !routes && !routesLoading) {
      fetchRoutes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleFetchArrivals = async (stopId, tab) => {
    clearBusTracking();
    setTrackingView(false);
    const stopName = await fetchArrivals(stopId);
    addToHistory(stopId, stopName);
    setArrivalsTab(tab);
  };

  // Navigation always dismisses tracking so the right-hand map returns to nearby.
  const switchTab = (tab) => {
    clearBusTracking();
    setTrackingView(false);
    setActiveTab(tab);
  };

  const showToast = (message, type = "add") => {
    setToast(message);
    setToastType(type);
    setToastFading(false);
    setTimeout(() => setToastFading(true), 2000);
    setTimeout(() => setToast(null), 3200);
  };

  const fetchRoutes = async () => {
    setRoutesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/routes`);
      const data = await res.json();
      setRoutes(data.routes);
    } catch {
      setError("Could not load routes.");
    } finally {
      setRoutesLoading(false);
    }
  };

  const fetchRouteStops = async (route) => {
    setSelectedRoute(route);
    setRouteStopsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/route/${route.route_id}/stops`);
      const data = await res.json();
      setRouteStops(data.stops);
      setRouteShape(data.shape || null);
    } catch {
      setError("Could not load stops for this route.");
    } finally {
      setRouteStopsLoading(false);
    }
  };

  const filteredRoutes = routes
    ? routes.filter((r) => {
        const q = routeQuery.toLowerCase();
        return (
          r.route_short_name.toLowerCase().includes(q) ||
          r.route_long_name.toLowerCase().includes(q)
        );
      })
    : [];

  // Tabs where arrivals don't belong inline — search results go to Home instead.
  const tabForSearchResults = () =>
    activeTab === "settings" ? "nearby" : activeTab;

  const handleRouteQueryChange = (val) => {
    setRouteQuery(val);
  };

  const isRouteSearching = activeTab === "routes" && routeQuery.trim().length > 0;

  const handleSelectRoute = (route) => {
    fetchRouteStops(route);
    setRouteQuery("");
    if (arrivalsTab === "routes") {
      setArrivalsTab(null);
      clearBusTracking();
      setTrackingView(false);
    }
  };

  const handleSearch = () => {
    const target = tabForSearchResults();
    if (target !== activeTab) setActiveTab(target);

    if (/^\d+$/.test(searchQuery.trim())) {
      handleFetchArrivals(searchQuery.trim(), target);
    } else {
      searchByAddress(searchQuery);
    }
  };

  const searchProps = {
    query: searchQuery,
    setQuery: setSearchQuery,
    onSearch: handleSearch,
    searching: searchingAddress,
    nearbyStops,
    onSelectStop: (stopId) => {
      const target = tabForSearchResults();
      if (target !== activeTab) setActiveTab(target);
      handleFetchArrivals(stopId, target);
      clearNearbyStops();
      setSearchQuery("");
    },
    onClear: () => {
      setSearchQuery("");
      clearNearbyStops();
    },
  };

  // ── PWA system back button ────────────────────────────────────────────────
  // True whenever the user has navigated "deeper" than the base tab list.
  const isDeep =
    (trackingView && !!busLocation) ||
    routeMapView ||
    (!!arrivals && arrivalsTab === activeTab) ||
    (activeTab === "routes" && !!selectedRoute);

  // Keep backHandlerRef and showToastRef current after every render so the
  // popstate listener (registered once) never holds stale closures.
  useEffect(() => {
    showToastRef.current = showToast;
    isDeepRef.current = isDeep;
    activeTabRef.current = activeTab;
    backHandlerRef.current = () => {
      if (trackingView && busLocation) {
        setTrackingView(false);
        clearBusTracking();
      } else if (routeMapView) {
        setRouteMapView(false);
      } else if (arrivals && arrivalsTab === activeTab) {
        if (activeTab === "nearby") {
          if (nearbyStopStack.length > 0) {
            const prev = nearbyStopStack[nearbyStopStack.length - 1];
            setNearbyStopStack((s) => s.slice(0, -1));
            handleFetchArrivals(prev, "nearby");
          } else if (busLocation && isMobile) {
            setTrackingView(true);
            clearArrivals();
            setStopSearchQuery("");
          } else {
            clearArrivals();
            setNearbyStopStack([]);
            setStopSearchQuery("");
          }
        } else if (activeTab === "history" || activeTab === "favorites") {
          clearBusTracking();
          setTrackingView(false);
          setArrivalsTab(null);
          clearArrivals();
        } else if (activeTab === "routes") {
          // Keep selectedRoute so the map stays on RouteMap; just dismiss arrivals.
          clearBusTracking();
          setTrackingView(false);
          setArrivalsTab(null);
        }
      } else if (activeTab === "routes" && selectedRoute) {
        setSelectedRoute(null);
        setRouteStops(null);
        setRouteShape(null);
        setRouteMapView(false);
        clearArrivals();
      } else if (activeTab !== "nearby") {
        // Base level of a non-home tab — go back to home.
        setActiveTab("nearby");
      }
    };
  });

  // Intercept the OS back gesture while inside the app.
  useEffect(() => {
    // Push a sentinel so there is always at least one history entry behind us.
    // Without this, Android fires no popstate when at the start of history —
    // it just closes the PWA silently, bypassing all our back-button logic.
    history.pushState({ dabusReady: true }, "");

    const onPopState = () => {
      if (isDeepRef.current || activeTabRef.current !== "nearby") {
        // Inside the app — re-push the sentinel so the next back press is also caught,
        // then run the in-app back action (goes deeper → shallower → home tab).
        history.pushState({ dabusReady: true }, "");
        backHandlerRef.current?.();
        // Cancel any stale exit prompt when navigating within the app.
        clearTimeout(exitTimerRef.current);
        exitGuardRef.current = false;
      } else if (!exitGuardRef.current) {
        // First back at home base — re-push sentinel, show the exit prompt.
        history.pushState({ dabusReady: true }, "");
        exitGuardRef.current = true;
        showToastRef.current?.("Press back again to exit", "info");
        exitTimerRef.current = setTimeout(() => {
          exitGuardRef.current = false;
        }, 2000);
      } else {
        // Second back within the window — let the browser handle it (exits the PWA).
        clearTimeout(exitTimerRef.current);
        exitGuardRef.current = false;
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const tabContent = (
    <>
      {activeTab === "history" && (!arrivals || arrivalsTab !== "history") && (
        <StopHistory
          stopHistory={stopHistory}
          onSelectStop={(stopId) => handleFetchArrivals(stopId, "history")}
          onRemoveStop={removeFromHistory}
          onClearHistory={clearHistory}
        />
      )}

      {activeTab === "favorites" &&
        (!arrivals || arrivalsTab !== "favorites") && (
          <Favorites
            favorites={favorites}
            onSelectStop={(stopId) => handleFetchArrivals(stopId, "favorites")}
            onRemoveFavorite={(stopId) => {
              removeFavorite(stopId);
              showToast("Stop removed", "remove");
            }}
          />
        )}

      {activeTab === "routes" && (arrivalsTab !== "routes" || isRouteSearching) && (
        <RoutesTab
          routes={routes}
          routesLoading={routesLoading}
          filteredRoutes={filteredRoutes}
          routeQuery={routeQuery}
          selectedRoute={selectedRoute}
          routeStops={routeStops}
          routeStopsLoading={routeStopsLoading}
          onSelectRoute={handleSelectRoute}
          onClearRoute={null}
          onSelectStop={(stopId) => handleFetchArrivals(stopId, "routes")}
          onViewOnMap={isMobile ? () => setRouteMapView(true) : null}
          alertsForRoute={alertsForRoute}
          dismissedAlertsForRoute={dismissedAlertsForRoute}
          onDismissAlert={dismissAlert}
          onRestoreAlerts={restoreAlerts}
        />
      )}

      {activeTab === "settings" && (
        <SettingsTab
          settings={settings}
          onUpdateSetting={updateSetting}
          onClearHistory={clearHistory}
          onClearFavorites={() => {
            clearFavorites();
            showToast("Favorites cleared", "remove");
          }}
          installPrompt={installPrompt}
          isInstalled={isInstalled}
          onInstall={async () => {
            if (!installPrompt) return;
            installPrompt.prompt();
            const { outcome } = await installPrompt.userChoice;
            if (outcome === "accepted") {
              setInstallPrompt(null);
              setIsInstalled(true);
            }
          }}
        />
      )}

      {loading && <p>Loading arrivals...</p>}
      {error && <p role="alert">{error}</p>}
      <PullToRefreshIndicator isPulling={isPulling} pullDistance={pullDistance} triggered={triggered} />

      <ErrorBoundary>
        {arrivals && arrivalsTab === activeTab && !isRouteSearching && (
          <ArrivalsList
            arrivals={arrivals}
            selectedBus={selectedBus}
            trackingLoading={trackingLoading}
            onShowMap={(bus) => {
              fetchBusLocation(bus);
              setTrackingView(true);
            }}
            currentStop={currentStop}
            isFavorited={isCurrentStopFavorited(currentStop)}
            onSaveStop={(isFavorited) => {
              if (isFavorited) {
                removeFavorite(currentStop.id);
                showToast("Stop removed", "remove");
              } else {
                setShowSaveModal(true);
              }
            }}
            lastUpdated={lastUpdated}
            onRefresh={() => fetchArrivals(currentStop.id)}
            arrivalsTab={arrivalsTab}
            routeShortName={arrivalsTab === "routes" ? selectedRoute?.route_short_name : null}
            alerts={(() => {
              // Union of alerts across every route arriving at this stop, deduped by id.
              const seen = new Map();
              for (const bus of arrivals || []) {
                for (const a of alertsForRoute(bus.route)) {
                  if (!seen.has(a.id)) seen.set(a.id, a);
                }
              }
              return [...seen.values()];
            })()}
            hiddenAlerts={(() => {
              // Same union, but for previously dismissed alerts. Drives the
              // "Show N hidden alerts" link.
              const seen = new Map();
              for (const bus of arrivals || []) {
                for (const a of dismissedAlertsForRoute(bus.route)) {
                  if (!seen.has(a.id)) seen.set(a.id, a);
                }
              }
              return [...seen.values()];
            })()}
            onDismissAlert={dismissAlert}
            onRestoreAlerts={restoreAlerts}
            onBack={
              arrivalsTab === "favorites" ||
              arrivalsTab === "history" ||
              (arrivalsTab === "routes" && !isMobile)
                ? () => {
                    clearBusTracking();
                    setTrackingView(false);
                    setArrivalsTab(null);
                  }
                : null
            }

          />
        )}
      </ErrorBoundary>
    </>
  );

  return (
    <div className={styles.shell}>
      {/* Mobile-only top search bar */}
      {!trackingView && (
        activeTab === "nearby" ||
        activeTab === "routes" ||
        ((activeTab === "history" || activeTab === "favorites") && arrivals && arrivalsTab === activeTab)
      ) && (
        <div className={styles.topBar}>
          {(activeTab === "nearby" && arrivals && arrivalsTab === "nearby") ||
          (activeTab === "routes" && (selectedRoute || (arrivals && arrivalsTab === "routes"))) ||
          ((activeTab === "history" || activeTab === "favorites") && arrivals && arrivalsTab === activeTab) ? (
            <div className={styles.topBarSearch}>
              <button
                className={styles.topBarBack}
                aria-label="Back"
                onClick={() => {
                  if (activeTab === "nearby") {
                    if (nearbyStopStack.length > 0) {
                      const prev = nearbyStopStack[nearbyStopStack.length - 1];
                      setNearbyStopStack((s) => s.slice(0, -1));
                      handleFetchArrivals(prev, "nearby");
                    } else if (busLocation && isMobile) {
                      setTrackingView(true);
                      clearArrivals();
                      setStopSearchQuery("");
                    } else {
                      clearArrivals();
                      setNearbyStopStack([]);
                      setStopSearchQuery("");
                    }
                    return;
                  }
                  if (activeTab === "history" || activeTab === "favorites") {
                    clearBusTracking();
                    setTrackingView(false);
                    setArrivalsTab(null);
                    clearArrivals();
                    return;
                  }
                  if (activeTab === "routes" && routeQuery) {
                    setRouteQuery("");
                  } else if (activeTab === "routes" && arrivals && arrivalsTab === "routes") {
                    clearBusTracking();
                    setTrackingView(false);
                    setArrivalsTab(null);
                  } else if (activeTab === "routes") {
                    setSelectedRoute(null);
                    setRouteStops(null);
                    setRouteShape(null);
                    setRouteMapView(false);
                  } else {
                    clearBusTracking();
                    setTrackingView(false);
                    setArrivalsTab(null);
                  }
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
              </button>
              <div className={styles.topBarSearchInput}>
                {activeTab === "nearby" && (
                  <SearchInput
                    value={stopSearchQuery}
                    onChange={setStopSearchQuery}
                    placeholder="Stop number"
                    ariaLabel="Bus stop number"
                    onClear={() => setStopSearchQuery("")}
                    onSubmit={() => {
                      const id = stopSearchQuery.trim();
                      if (!id || id === String(currentStop?.id)) return;
                      setNearbyStopStack((s) => [...s, currentStop.id]);
                      handleFetchArrivals(id, "nearby");
                    }}
                  />
                )}
                {activeTab === "routes" && (
                  <SearchInput
                    value={routeQuery}
                    onChange={handleRouteQueryChange}
                    placeholder="Search routes"
                    onClear={() => setRouteQuery("")}
                  />
                )}
                {(activeTab === "history" || activeTab === "favorites") && currentStop && (
                  <span className={styles.trackingLabel}>
                    {activeTab === "favorites"
                      ? (favorites.find(f => f.stop_id === currentStop.id)?.custom_name || currentStop.name || `Stop #${currentStop.id}`)
                      : (currentStop.name || `Stop #${currentStop.id}`)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <>
              {activeTab === "nearby" && <AddressSearch {...searchProps} />}
              {activeTab === "routes" && (
                <SearchInput
                  value={routeQuery}
                  onChange={handleRouteQueryChange}
                  placeholder="Search routes"
                  onClear={() => setRouteQuery("")}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Center column */}
      <main className={styles.main}>
        {/* Desktop search bar — hidden on history/favorites list view (no search needed) */}
        <div className={styles.desktopSearch} style={
          activeTab === "settings" ||
          ((activeTab === "history" || activeTab === "favorites") &&
            !(arrivals && arrivalsTab === activeTab))
            ? { display: "none" }
            : undefined
        }>
          {activeTab === "nearby" && arrivals && arrivalsTab === "nearby" ? (
            <div className={styles.topBarSearch}>
              <button
                className={styles.topBarBack}
                aria-label="Back"
                onClick={() => {
                  if (nearbyStopStack.length > 0) {
                    const prev = nearbyStopStack[nearbyStopStack.length - 1];
                    setNearbyStopStack((s) => s.slice(0, -1));
                    handleFetchArrivals(prev, "nearby");
                  } else {
                    clearArrivals();
                    setNearbyStopStack([]);
                    setStopSearchQuery("");
                  }
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
              </button>
              <div className={styles.topBarSearchInput}>
                <SearchInput
                  value={stopSearchQuery}
                  onChange={setStopSearchQuery}
                  placeholder="Stop number"
                  ariaLabel="Bus stop number"
                  onClear={() => setStopSearchQuery("")}
                  onSubmit={() => {
                    const id = stopSearchQuery.trim();
                    if (!id || id === String(currentStop?.id)) return;
                    setNearbyStopStack((s) => [...s, currentStop.id]);
                    handleFetchArrivals(id, "nearby");
                  }}
                />
              </div>
            </div>
          ) : activeTab === "routes" && (selectedRoute || (arrivals && arrivalsTab === "routes")) ? (
            <div className={styles.topBarSearch}>
              <button
                className={styles.topBarBack}
                aria-label="Back"
                onClick={() => {
                  if (routeQuery) {
                    setRouteQuery("");
                  } else if (arrivals && arrivalsTab === "routes") {
                    clearBusTracking();
                    setTrackingView(false);
                    setArrivalsTab(null);
                  } else {
                    setSelectedRoute(null);
                    setRouteStops(null);
                    setRouteShape(null);
                    setRouteMapView(false);
                  }
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
              </button>
              <div className={styles.topBarSearchInput}>
                <SearchInput
                  value={routeQuery}
                  onChange={handleRouteQueryChange}
                  placeholder="Search routes"
                  onClear={() => setRouteQuery("")}
                />
              </div>
            </div>
          ) : (activeTab === "history" || activeTab === "favorites") && arrivals && arrivalsTab === activeTab ? (
            <div className={styles.topBarSearch}>
              <button
                className={styles.topBarBack}
                aria-label="Back"
                onClick={() => {
                  clearBusTracking();
                  setTrackingView(false);
                  setArrivalsTab(null);
                  clearArrivals();
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
              </button>
              {currentStop && (
                <span className={styles.trackingLabel}>
                  {activeTab === "favorites"
                    ? (favorites.find(f => f.stop_id === currentStop.id)?.custom_name || currentStop.name || `Stop #${currentStop.id}`)
                    : (currentStop.name || `Stop #${currentStop.id}`)}
                </span>
              )}
            </div>
          ) : activeTab === "routes" ? (
            <SearchInput
              value={routeQuery}
              onChange={handleRouteQueryChange}
              placeholder="Search routes"
              onClear={() => setRouteQuery("")}
            />
          ) : activeTab === "history" || activeTab === "favorites" || activeTab === "settings" ? null : (
            <AddressSearch {...searchProps} />
          )}
        </div>

        <div className={styles.desktopContent}>
          {/* Nearby map — mobile only (desktop uses mapPanel) */}
          {activeTab === "nearby" && (!arrivals || arrivalsTab !== "nearby") && (
            <div className={styles.mobileMapOnly}>
              <NearbyStopsMap
                userLocation={userLocation}
                nearbyStopsMap={nearbyStopsMap}
                onSelectStop={(stopId) => handleFetchArrivals(stopId, "nearby")}
                onMount={findNearbyStops}
                mapCenter={mapCenter}
                onMapMove={setMapCenter}
                searchRadius={settings.searchRadius}
                onRefreshLocation={findNearbyStops}
                locating={locating}
              />
            </div>
          )}

          {tabContent}
        </div>
      </main>

      {/* Desktop map panel */}
      <div className={styles.mapPanel}>
        <ErrorBoundary>
          {trackingView && busLocation ? (
            <>
              <div className={styles.desktopSearch}>
                <div className={styles.topBarSearch}>
                  <button
                    className={styles.topBarBack}
                    aria-label="Back to map"
                    onClick={() => {
                      setTrackingView(false);
                      clearBusTracking();
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                    </svg>
                  </button>
                  <span className={styles.trackingLabel}>
                    Route {busLocation.route_short_name} — {busLocation.headsign}
                  </span>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <BusTrackingMap
                  busLocation={busLocation}
                  userLocation={userLocation}
                  selectedBus={selectedBus}
                  busShape={busShape}
                  tripStops={tripStops}
                  initialCenter={trackingMapCenter}
                  onMapMove={setTrackingMapCenter}
                  onGetArrivals={(stopId) => {
                    // Keep trackingView + busLocation intact so the mapPanel
                    // stays on BusTrackingMap — same pattern as RouteMap.
                    if (activeTab !== "nearby") setActiveTab("nearby");
                    setNearbyStopStack([]);
                    fetchArrivals(stopId).then((stopName) => {
                      addToHistory(stopId, stopName);
                      setArrivalsTab("nearby");
                    });
                  }}
                />
              </div>
            </>
          ) : activeTab === "routes" && selectedRoute ? (
            <RouteMap
              shape={routeShape}
              stops={routeStops}
              selectedStopId={
                arrivals && arrivalsTab === "routes" ? currentStop?.id : null
              }
              userLocation={userLocation}
              onSelectStop={(stopId) => handleFetchArrivals(stopId, "routes")}
              fullHeight
            />
          ) : (
            <NearbyStopsMap
              userLocation={userLocation}
              nearbyStopsMap={nearbyStopsMap}
              locating={locating}
              onSelectStop={(stopId) => {
                if (activeTab !== "nearby") setActiveTab("nearby");
                handleFetchArrivals(stopId, "nearby");
              }}
              onMount={() => {}}
              mapCenter={mapCenter}
              onMapMove={setMapCenter}
              fullHeight
              searchRadius={settings.searchRadius}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* Mobile bus tracking overlay — only mount on mobile so the hidden
          Leaflet container on desktop doesn't error on init */}
      <ErrorBoundary>
        {isMobile && trackingView && busLocation && (
          <div
            className={styles.mobileTrackingOverlay}
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--bg)",
              zIndex: 1100,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className={styles.topBar}>
              <div className={styles.topBarSearch}>
                <button
                  className={styles.topBarBack}
                  aria-label="Back to arrivals"
                  onClick={() => {
                    setTrackingView(false);
                    clearBusTracking();
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
                </button>
                <span className={styles.trackingLabel}>
                  Route {busLocation.route_short_name} — {busLocation.headsign}
                </span>
              </div>
            </div>
            <div style={{ flex: 1, height: 0 }}>
              <BusTrackingMap
                busLocation={busLocation}
                userLocation={userLocation}
                selectedBus={selectedBus}
                busShape={busShape}
                tripStops={tripStops}
                initialCenter={trackingMapCenter}
                onMapMove={setTrackingMapCenter}
                onGetArrivals={(stopId) => {
                  setNearbyStopStack([]);
                  // Close the overlay so arrivals are visible, but keep
                  // busLocation so the back button can return to tracking.
                  setTrackingView(false);
                  fetchArrivals(stopId).then((stopName) => {
                    addToHistory(stopId, stopName);
                    setArrivalsTab("nearby");
                    if (activeTab !== "nearby") setActiveTab("nearby");
                  });
                }}
              />
            </div>
          </div>
        )}
      </ErrorBoundary>

      {/* Mobile route-map overlay */}
      <ErrorBoundary>
        {isMobile && routeMapView && selectedRoute && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--bg)",
              zIndex: 1100,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className={styles.topBar}>
              <div className={styles.topBarSearch}>
                <button
                  className={styles.topBarBack}
                  aria-label="Back to stops"
                  onClick={() => setRouteMapView(false)}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
                </button>
                <span className={styles.trackingLabel}>
                  Route {selectedRoute.route_short_name} — {selectedRoute.route_long_name}
                </span>
              </div>
            </div>
            <div style={{ flex: 1, height: 0 }}>
              <RouteMap
                shape={routeShape}
                stops={routeStops}
                selectedStopId={
                  arrivals && arrivalsTab === "routes" ? currentStop?.id : null
                }
                userLocation={userLocation}
                onSelectStop={(stopId) => {
                  setRouteMapView(false);
                  handleFetchArrivals(stopId, "routes");
                }}
                fullHeight
              />
            </div>
          </div>
        )}
      </ErrorBoundary>

      {/* Nav */}
      <nav className={styles.bottomNav}>
        <div className={styles.brandMark}>
          <img src="/dabus-icon.png" alt="" role="presentation" />
        </div>
        <button
          className={`${styles.navBtn} ${activeTab === "nearby" ? styles.active : ""}`}
          onClick={() => switchTab("nearby")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          </svg>
          <span>Home</span>
        </button>

        <button
          className={`${styles.navBtn} ${activeTab === "routes" ? styles.active : ""}`}
          onClick={() => switchTab("routes")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="5" cy="6" r="2" fill="currentColor" />
            <circle cx="19" cy="18" r="2" fill="currentColor" />
            <path d="M7 6h4a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4" />
            <path d="M7 6h4" />
          </svg>
          <span>Routes</span>
        </button>

        <button
          className={`${styles.navBtn} ${activeTab === "history" ? styles.active : ""}`}
          onClick={() => switchTab("history")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Recent</span>
        </button>

        <button
          className={`${styles.navBtn} ${activeTab === "favorites" ? styles.active : ""}`}
          onClick={() => switchTab("favorites")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>Favorites</span>
        </button>

        <button
          className={`${styles.navBtn} ${activeTab === "settings" ? styles.active : ""}`}
          onClick={() => switchTab("settings")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </nav>

      {showSaveModal && currentStop && (
        <SaveStopModal
          stop={currentStop}
          onSave={(customName) => {
            saveToFavorites(currentStop, customName);
            setShowSaveModal(false);
            showToast("Stop saved");
          }}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      {toast && <Toast message={toast} type={toastType} fading={toastFading} />}
    </div>
  );
}

export default App;
