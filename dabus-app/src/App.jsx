import { useState, useEffect } from "react";
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
    offIsland,
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

  // Refetch nearby stops whenever the radius or user's location changes.
  // Runs regardless of active tab so changes from Settings take effect before
  // the user navigates back to Home.
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

  const TAB_NAMES = ["nearby", "routes", "history", "favorites", "settings"];

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

      {activeTab === "routes" && arrivalsTab !== "routes" && (
        <RoutesTab
          routes={routes}
          routesLoading={routesLoading}
          filteredRoutes={filteredRoutes}
          selectedRoute={selectedRoute}
          routeStops={routeStops}
          routeStopsLoading={routeStopsLoading}
          onSelectRoute={fetchRouteStops}
          onClearRoute={() => {
            setSelectedRoute(null);
            setRouteStops(null);
            setRouteShape(null);
            setRouteMapView(false);
          }}
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
        />
      )}

      {loading && <p>Loading arrivals...</p>}
      {error && <p role="alert">{error}</p>}
      <PullToRefreshIndicator isPulling={isPulling} pullDistance={pullDistance} triggered={triggered} />

      <ErrorBoundary>
        {arrivals && arrivalsTab === activeTab && (
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
              arrivalsTab === "routes" ||
              (arrivalsTab === "nearby" && isMobile)
                ? () => {
                    if (arrivalsTab === "nearby") clearArrivals();
                    clearBusTracking();
                    setTrackingView(false);
                    setArrivalsTab(null);
                  }
                : null
            }
            onBackToTracking={busLocation && isMobile ? () => setTrackingView(true) : null}
          />
        )}
      </ErrorBoundary>
    </>
  );

  return (
    <div className={styles.shell}>
      {/* Mobile-only top search bar */}
      {(activeTab === "nearby" || activeTab === "routes") && !trackingView && (
        <header className={styles.topBar} role="banner">
          {activeTab === "nearby" && <AddressSearch {...searchProps} />}
          {activeTab === "routes" && (
            <SearchInput
              value={routeQuery}
              onChange={setRouteQuery}
              placeholder="Search routes"
              onClear={() => setRouteQuery("")}
            />
          )}
        </header>
      )}

      {/* Center column */}
      <main className={styles.main} id="main-content">
        {/* Desktop search bar */}
        <div className={styles.desktopSearch}>
          {activeTab === "routes" ? (
            <SearchInput
              value={routeQuery}
              onChange={setRouteQuery}
              placeholder="Search routes"
              onClear={() => setRouteQuery("")}
            />
          ) : (
            <AddressSearch {...searchProps} />
          )}
        </div>

        <div className={styles.desktopContent}>
          {/* Off-island notice — shown instead of map when GPS is outside Oahu */}
          {activeTab === "nearby" && offIsland && (!arrivals || arrivalsTab !== "nearby") && (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)" }}>
              <p style={{ fontSize: "2rem", marginBottom: "8px" }}>🌺</p>
              <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: "6px" }}>
                You're not on Oahu
              </p>
              <p style={{ fontSize: "14px", lineHeight: 1.5 }}>
                Where Da Bus Stay only covers Oahu's TheBus. You can still search
                by stop number or browse routes above.
              </p>
            </div>
          )}

          {/* Nearby map — mobile only (desktop uses mapPanel) */}
          {activeTab === "nearby" && !offIsland && (!arrivals || arrivalsTab !== "nearby") && (
            <div className={styles.mobileMapOnly}>
              <NearbyStopsMap
                userLocation={userLocation}
                nearbyStopsMap={nearbyStopsMap}
                onSelectStop={(stopId) => handleFetchArrivals(stopId, "nearby")}
                onMount={findNearbyStops}
                mapCenter={mapCenter}
                onMapMove={setMapCenter}
                searchRadius={settings.searchRadius}
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
              <div
                style={{
                  padding: "12px 16px",
                  background: "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => {
                    setTrackingView(false);
                    clearBusTracking();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "14px",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ← Back to map
                </button>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                  }}
                >
                  Route {busLocation.route_short_name} — {busLocation.headsign}
                </p>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <BusTrackingMap
                  busLocation={busLocation}
                  userLocation={userLocation}
                  selectedBus={selectedBus}
                  busShape={busShape}
                  tripStops={tripStops}
                  onGetArrivals={(stopId) => {
                    if (activeTab !== "nearby") setActiveTab("nearby");
                    setArrivalsTab(null);
                    setTrackingView(false);
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
          ) : offIsland ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", padding: "32px", textAlign: "center" }}>
              <p style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🌺</p>
              <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: "8px", fontSize: "16px" }}>
                You're not on Oahu
              </p>
              <p style={{ fontSize: "14px", lineHeight: 1.5, maxWidth: "260px" }}>
                Where Da Bus Stay covers Oahu's TheBus only. Search by stop number or browse routes to plan ahead.
              </p>
            </div>
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
            <div
              style={{
                padding: "12px 16px",
                background: "var(--surface)",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => {
                  setTrackingView(false);
                  clearBusTracking();
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  fontSize: "14px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ← Back to arrivals
              </button>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                Route {busLocation.route_short_name} — {busLocation.headsign}
              </p>
            </div>
            <div style={{ flex: 1, height: 0 }}>
              <BusTrackingMap
                busLocation={busLocation}
                userLocation={userLocation}
                selectedBus={selectedBus}
                busShape={busShape}
                tripStops={tripStops}
                onGetArrivals={(stopId) => {
                  fetchArrivals(stopId).then((stopName) => {
                    addToHistory(stopId, stopName);
                    setArrivalsTab(activeTab);
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
            <div
              style={{
                padding: "12px 16px",
                background: "var(--surface)",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setRouteMapView(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  fontSize: "14px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ← Back to stops
              </button>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                Route {selectedRoute.route_short_name} — {selectedRoute.route_long_name}
              </p>
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

      {/* Nav — MD3 Navigation Bar (custom — labs web component is unreliable in React) */}
      <nav className={styles.bottomNav}>
        {[
          { id: "nearby",    icon: "location_on",  label: "Home"      },
          { id: "routes",    icon: "directions_bus",label: "Routes"    },
          { id: "history",   icon: "history",       label: "Recent"    },
          { id: "favorites", icon: "favorite",      label: "Favorites" },
          { id: "settings",  icon: "settings",      label: "Settings"  },
        ].map(({ id, icon, label }) => (
          <button
            key={id}
            className={`${styles.navTab} ${activeTab === id ? styles.navTabActive : ""}`}
            onClick={() => switchTab(id)}
            aria-label={label}
            aria-current={activeTab === id ? "page" : undefined}
          >
            <span className={styles.navTabIndicator}>
              <span className="material-symbols-rounded">{icon}</span>
            </span>
            <span className={styles.navTabLabel}>{label}</span>
          </button>
        ))}
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
