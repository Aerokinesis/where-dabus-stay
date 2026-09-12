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
import ConfirmDialog from "./components/ConfirmDialog";
import RecentStopsSheet from "./components/RecentStopsSheet";
import RoutesTab from "./components/RoutesTab";
import RouteMap from "./components/RouteMap";
import SettingsTab from "./components/SettingsTab";
import AnnouncementsTab from "./components/AnnouncementsTab";
import FaqScreen from "./components/FaqScreen";
import ContactScreen from "./components/ContactScreen";
import Toast from "./components/Toast";
import SearchInput from "./components/SearchInput";
import BackButton from "./components/BackButton";
import { useArrivals } from "./hooks/useArrivals";
import { useFavorites } from "./hooks/useFavorites";
import { useNearbyStops } from "./hooks/useNearbyStops";
import { useBusTracking } from "./hooks/useBusTracking";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import PullToRefreshIndicator from "./components/PullToRefreshIndicator";
import { useStopHistory } from "./hooks/useStopHistory";
import { useSettings } from "./hooks/useSettings";
import { useToast } from "./hooks/useToast";
import { useUpdateCheck } from "./hooks/useUpdateCheck";
import { useAndroidBack } from "./hooks/useAndroidBack";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { usePwaInstall } from "./hooks/usePwaInstall";
import InstallBanner from "./components/InstallBanner";
import { useRoutes } from "./hooks/useRoutes";
import { useAlerts } from "./hooks/useAlerts";
import { useAnnouncements } from "./hooks/useAnnouncements";
import { useAppMeta } from "./hooks/useAppMeta";
import { API_BASE } from "./constants";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Back button + "Route N — destination" label row shared by the desktop
// tracking panel and both mobile fullscreen overlays.
function PanelHeader({ backLabel, onBack, title }) {
  return (
    <div className={styles.topBarSearch}>
      <BackButton label={backLabel} onClick={onBack} />
      <span className={styles.trackingLabel}>{title}</span>
    </div>
  );
}

// Fullscreen mobile overlay chrome (bus-tracking + route-map overlays).
function MobileOverlay({ className, children }) {
  return (
    <div
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}

function App() {
  // Settings must be first — other hooks depend on settings.searchRadius
  const { settings, updateSetting } = useSettings();
  const isMobile = useMediaQuery("(max-width: 639px)");

  const [searchQuery, setSearchQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [confirmClear, setConfirmClear] = useState(null); // "history" | "favorites" | null
  const [activeTab, setActiveTab] = useState("nearby");
  const [trackingView, setTrackingView] = useState(false);
  const [routeMapView, setRouteMapView] = useState(false);
  // Settings -> FAQ sub-screen. Lives here (not in SettingsTab) so it can feed
  // isDeep/handleSystemBack below and system back closes it instead of the app.
  const [faqView, setFaqView] = useState(false);
  const [contactView, setContactView] = useState(false);
  const [arrivalsTab, setArrivalsTab] = useState(null);
  // Stop IDs previously visited on the nearby tab — used to navigate back.
  const [nearbyStopStack, setNearbyStopStack] = useState([]);
  const [stopSearchQuery, setStopSearchQuery] = useState("");
  const [showRecentSheet, setShowRecentSheet] = useState(false);

  // PWA install prompt — see usePwaInstall.
  const {
    installPrompt,
    isInstalled,
    promptInstall,
    platform: installPlatform,
    showBanner: showInstallBanner,
    dismissBanner: dismissInstallBanner,
  } = usePwaInstall();

  const { toast, toastType, toastFading, showToast } = useToast();
  const updateAvailable = useUpdateCheck();
  const dataUpdated = useAppMeta();

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

  // Routes-tab data (list fetch, selected route, stops/shape) — see useRoutes.
  const {
    routes,
    setRoutes,
    routesLoading,
    selectedRoute,
    routeStops,
    routeShape,
    routeStopsLoading,
    fetchRouteStops,
    clearRouteSelection,
  } = useRoutes(setError, activeTab === "routes");

  const {
    favorites,
    saveToFavorites,
    renameFavorite,
    removeFavorite,
    clearFavorites,
    isCurrentStopFavorited,
  } = useFavorites();
  // Favorite being renamed via the edit modal (null = closed).
  const [editingFavorite, setEditingFavorite] = useState(null);

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

  // Community announcements feed + unread dot on the nav icon.
  const {
    posts: announcementPosts,
    loading: announcementsLoading,
    error: announcementsError,
    configured: announcementsConfigured,
    unreadCount: announcementsUnread,
    markSeen: markAnnouncementsSeen,
  } = useAnnouncements();

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

  // ── Deep links ────────────────────────────────────────────────────────────
  // Restore state from the URL on launch: /?stop=45 opens that stop's
  // arrivals, /?route=53 opens that route on the routes tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stopId = params.get("stop");
    const routeId = params.get("route");
    if (stopId && /^\d+$/.test(stopId)) {
      handleFetchArrivals(stopId, "nearby");
    } else if (routeId) {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/routes`);
          const data = await res.json();
          const route = data.routes?.find(
            (r) => String(r.route_id) === routeId,
          );
          if (route) {
            setRoutes(data.routes);
            setActiveTab("routes");
            fetchRouteStops(route);
          }
        } catch {
          // Bad or offline deep link — just start at home.
        }
      })();
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the current view into the URL so refresh keeps your place and the
  // address bar is always shareable. IMPORTANT: replaceState only — it
  // rewrites the CURRENT history entry (preserving its dabusReady state) and
  // never adds or removes entries, so the useAndroidBack tap-funded history
  // discipline is unaffected.
  useEffect(() => {
    const params = new URLSearchParams();
    if (arrivals && currentStop) {
      params.set("stop", currentStop.id);
    } else if (activeTab === "routes" && selectedRoute) {
      params.set("route", selectedRoute.route_id);
    }
    const next = params.toString() ? `?${params.toString()}` : "";
    if (next !== window.location.search) {
      history.replaceState(
        history.state,
        "",
        `${window.location.pathname}${next}`,
      );
    }
  }, [arrivals, currentStop, activeTab, selectedRoute]);
  // ──────────────────────────────────────────────────────────────────────────

  const handleFetchArrivals = async (stopId, tab) => {
    clearBusTracking();
    setTrackingView(false);
    clearNearbyStops();
    const stopName = await fetchArrivals(stopId);
    addToHistory(stopId, stopName);
    setArrivalsTab(tab);
  };

  // Navigation always dismisses tracking so the right-hand map returns to nearby.
  const switchTab = (tab) => {
    clearBusTracking();
    setTrackingView(false);
    setFaqView(false);
    setActiveTab(tab);
  };

  // Tapping Home always lands on a clean Home screen. Unlike switchTab, this
  // also unwinds any open arrivals and the stop-search stack, so a user deep
  // in stop searches (e.g. 123 -> 986 -> 442) returns to the nearby map in a
  // single tap instead of stepping back through each previous stop.
  const goHome = () => {
    // Two-stage Home: from another tab, just return to the nearby tab as it
    // was left — a settings/routes detour must not wipe an open stop. Only a
    // tap while ALREADY on nearby performs the full clean-home reset below.
    if (activeTab !== "nearby") {
      setFaqView(false);
      setActiveTab("nearby");
      return;
    }
    clearBusTracking();
    setTrackingView(false);
    clearArrivals();
    setArrivalsTab(null);
    setNearbyStopStack([]);
    setStopSearchQuery("");
    setFaqView(false);
    setActiveTab("nearby");
  };

  // ── Shared back actions ───────────────────────────────────────────────────
  // Used by both the on-screen back buttons and the system back handler so
  // the two can never drift apart.

  // Dismiss the bus-tracking view.
  const exitTracking = () => {
    setTrackingView(false);
    clearBusTracking();
  };

  // Step back out of arrivals on the nearby tab: previous stop from the
  // stack, else back to tracking (mobile only), else clear arrivals.
  const backFromNearbyArrivals = () => {
    if (nearbyStopStack.length > 0) {
      const prev = nearbyStopStack[nearbyStopStack.length - 1];
      setNearbyStopStack((s) => s.slice(0, -1));
      handleFetchArrivals(prev, "nearby");
    } else if (busLocation && isMobile) {
      setTrackingView(true);
      clearArrivals();
      setStopSearchQuery("");
    } else {
      // Desktop: also dismiss any active tracking so the map panel returns
      // to nearby stops — back to home means all the way home.
      clearBusTracking();
      setTrackingView(false);
      clearArrivals();
      setNearbyStopStack([]);
      setStopSearchQuery("");
    }
  };

  // Dismiss the arrivals panel. Pass false to keep the loaded arrivals data
  // (the routes tab keeps the stop selected on its map).
  const dismissArrivals = (clear = true) => {
    clearBusTracking();
    setTrackingView(false);
    setArrivalsTab(null);
    if (clear) clearArrivals();
  };

  // Deselect the route on the routes tab.
  const clearSelectedRoute = () => {
    clearRouteSelection();
    setRouteMapView(false);
  };

  // Stop-number-or-street search submit (mobile top bar + desktop sidebar
  // share this). Digits go straight to that stop's arrivals; anything else
  // searches stop names and shows a dropdown via stopSearchProps below.
  const submitStopSearch = () => {
    const q = stopSearchQuery.trim();
    if (!q) return;
    if (/^\d+$/.test(q)) {
      if (q === String(currentStop?.id)) return;
      if (currentStop) setNearbyStopStack((s) => [...s, currentStop.id]);
      handleFetchArrivals(q, "nearby");
    } else {
      searchByAddress(q);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

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
    recentStops: stopHistory,
    onSeeAllRecent: () => setShowRecentSheet(true),
  };

  // Same stop-number-or-street search as searchProps above, but for the
  // "Stop number" top-bar slot shown once a stop is already being tracked
  // on the nearby tab. Selecting a result pushes the current stop onto the
  // back stack just like submitStopSearch's numeric path does.
  const stopSearchProps = {
    query: stopSearchQuery,
    setQuery: setStopSearchQuery,
    onSearch: submitStopSearch,
    searching: searchingAddress,
    nearbyStops,
    onSelectStop: (stopId) => {
      if (currentStop) setNearbyStopStack((s) => [...s, currentStop.id]);
      handleFetchArrivals(stopId, "nearby");
      clearNearbyStops();
    },
    onClear: () => {
      setStopSearchQuery("");
      clearNearbyStops();
    },
    recentStops: stopHistory,
    onSeeAllRecent: () => setShowRecentSheet(true),
  };

  // Shared map props — the desktop panel and the mobile overlays render the
  // same maps; only the stop-tap callbacks differ, and those stay inline at
  // each call site because their semantics are deliberately different.
  const trackingMapProps = {
    busLocation,
    userLocation,
    selectedBus,
    busShape,
    tripStops,
    initialCenter: trackingMapCenter,
    onMapMove: setTrackingMapCenter,
  };

  const routeMapProps = {
    shape: routeShape,
    stops: routeStops,
    selectedStopId: arrivals && arrivalsTab === "routes" ? currentStop?.id : null,
    userLocation,
    fullHeight: true,
  };

  // ── PWA system back button ────────────────────────────────────────────────
  // True whenever the user has navigated "deeper" than the base tab list.
  const isDeep =
    (trackingView && !!busLocation) ||
    routeMapView ||
    (!!arrivals && arrivalsTab === activeTab) ||
    (activeTab === "routes" && !!selectedRoute) ||
    (activeTab === "settings" && (faqView || contactView));

  // Performs ONE in-app back step (deeper → shallower → home tab).
  // Recreated every render so it always sees fresh state; useAndroidBack
  // keeps it in a ref for its once-registered popstate listener.
  const handleSystemBack = () => {
    if (trackingView && busLocation) {
      exitTracking();
    } else if (routeMapView) {
      setRouteMapView(false);
    } else if (arrivals && arrivalsTab === activeTab) {
      if (activeTab === "nearby") {
        backFromNearbyArrivals();
      } else if (activeTab === "favorites") {
        dismissArrivals();
      } else if (activeTab === "routes") {
        // Keep selectedRoute so the map stays on RouteMap; just dismiss arrivals.
        dismissArrivals(false);
      }
    } else if (activeTab === "routes" && selectedRoute) {
      clearSelectedRoute();
      clearArrivals();
    } else if (activeTab === "settings" && (faqView || contactView)) {
      setFaqView(false);
      setContactView(false);
    } else if (activeTab !== "nearby") {
      // Base level of a non-home tab — go back to home.
      setActiveTab("nearby");
    }
  };

  useAndroidBack({
    isDeep,
    isHome: activeTab === "nearby",
    onBack: handleSystemBack,
    showToast,
  });

  // Clear-all guardrail: every entry point (the recents sheet, Favorites edit
  // mode, both Settings buttons) routes through a confirm dialog instead of
  // clearing immediately.
  const requestClearHistory = () => {
    if (stopHistory.length === 0) return showToast("No recent stops to clear", "info");
    setConfirmClear("history");
  };
  const requestClearFavorites = () => {
    if (favorites.length === 0) return showToast("No favorites to clear", "info");
    setConfirmClear("favorites");
  };

  // Selecting a stop from the recent-stops sheet or dropdown always lands on
  // the nearby tab's arrivals — Recent no longer has its own tab to select
  // "into", so this mirrors stopSearchProps.onSelectStop below.
  const selectRecentStop = (stopId) => {
    if (currentStop) setNearbyStopStack((s) => [...s, currentStop.id]);
    handleFetchArrivals(stopId, "nearby");
    clearNearbyStops();
    setShowRecentSheet(false);
  };

  // "Route 42" chip on an announcement -> open that route on the Routes tab.
  // Mirrors the ?route= deep link: routes may not be loaded yet if the user
  // hasn't visited the tab, so fetch the list here rather than rely on state.
  const openRouteByShortName = async (shortName) => {
    try {
      const list =
        routes ||
        (await (await fetch(`${API_BASE}/api/routes`)).json()).routes ||
        [];
      const route = list.find((r) => r.route_short_name === shortName);
      if (!route) return showToast(`Route ${shortName} not found`, "info");
      if (!routes) setRoutes(list);
      clearBusTracking();
      setTrackingView(false);
      setActiveTab("routes");
      fetchRouteStops(route);
    } catch {
      showToast("Couldn't open route", "info");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const tabContent = (
    <>
      {activeTab === "favorites" &&
        (!arrivals || arrivalsTab !== "favorites") && (
          <Favorites
            favorites={favorites}
            onSelectStop={(stopId) => handleFetchArrivals(stopId, "favorites")}
            onEditFavorite={setEditingFavorite}
            onRemoveFavorite={(stopId) => {
              removeFavorite(stopId);
              showToast("Stop removed", "remove");
            }}
            onClearFavorites={requestClearFavorites}
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

      {activeTab === "announcements" && (
        <AnnouncementsTab
          posts={announcementPosts}
          loading={announcementsLoading}
          error={announcementsError}
          configured={announcementsConfigured}
          onShown={markAnnouncementsSeen}
          onSelectRoute={openRouteByShortName}
        />
      )}

      {activeTab === "settings" &&
        (faqView ? (
          <FaqScreen onBack={() => setFaqView(false)} />
        ) : contactView ? (
          <ContactScreen onBack={() => setContactView(false)} />
        ) : (
          <SettingsTab
            settings={settings}
            onUpdateSetting={updateSetting}
            onClearHistory={requestClearHistory}
            onClearFavorites={requestClearFavorites}
            installPrompt={installPrompt}
            isInstalled={isInstalled}
            onInstall={promptInstall}
            onOpenFaq={() => setFaqView(true)}
            onOpenContact={() => setContactView(true)}
            dataUpdated={dataUpdated}
          />
        ))}

      {loading && <p>Loading arrivals...</p>}
      {error && <p role="alert">{error}</p>}
      <PullToRefreshIndicator isPulling={isPulling} pullDistance={pullDistance} triggered={triggered} />

      {/* Install prompt. Held back while the user is deeper in the app (map
          views, arrivals, modals) so it never covers a map or a dialog. */}
      {showInstallBanner && !isDeep && !showSaveModal && (
        <InstallBanner
          platform={installPlatform}
          onInstall={promptInstall}
          onDismiss={dismissInstallBanner}
        />
      )}

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
              (arrivalsTab === "routes" && !isMobile)
                ? () => dismissArrivals(false)
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
        (activeTab === "favorites" && arrivals && arrivalsTab === activeTab)
      ) && (
        <div className={styles.topBar}>
          {(activeTab === "nearby" && arrivals && arrivalsTab === "nearby") ||
          (activeTab === "routes" && (selectedRoute || (arrivals && arrivalsTab === "routes"))) ||
          (activeTab === "favorites" && arrivals && arrivalsTab === activeTab) ? (
            <div className={styles.topBarSearch}>
              <BackButton
                onClick={() => {
                  if (activeTab === "nearby") return backFromNearbyArrivals();
                  if (activeTab === "favorites") return dismissArrivals();
                  if (activeTab === "routes" && routeQuery) return setRouteQuery("");
                  if (activeTab === "routes" && arrivals && arrivalsTab === "routes")
                    return dismissArrivals(false);
                  if (activeTab === "routes") return clearSelectedRoute();
                  dismissArrivals(false);
                }}
              />
              <div className={styles.topBarSearchInput}>
                {activeTab === "nearby" && <AddressSearch {...stopSearchProps} />}
                {activeTab === "routes" && (
                  <SearchInput
                    value={routeQuery}
                    onChange={handleRouteQueryChange}
                    placeholder="Search routes"
                    onClear={() => setRouteQuery("")}
                  />
                )}
                {activeTab === "favorites" && currentStop && (
                  <span className={styles.trackingLabel}>
                    {favorites.find(f => f.stop_id === currentStop.id)?.custom_name || currentStop.name || `Stop #${currentStop.id}`}
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
        {/* Desktop search bar — hidden on favorites list view (no search needed) */}
        <div className={styles.desktopSearch} style={
          activeTab === "settings" ||
          activeTab === "announcements" ||
          (activeTab === "favorites" &&
            !(arrivals && arrivalsTab === activeTab))
            ? { display: "none" }
            : undefined
        }>
          {activeTab === "nearby" && arrivals && arrivalsTab === "nearby" ? (
            <div className={styles.topBarSearch}>
              {/* isMobile is false here, so the tracking branch self-skips */}
              <BackButton onClick={backFromNearbyArrivals} />
              <div className={styles.topBarSearchInput}>
                <AddressSearch {...stopSearchProps} />
              </div>
            </div>
          ) : activeTab === "routes" && (selectedRoute || (arrivals && arrivalsTab === "routes")) ? (
            <div className={styles.topBarSearch}>
              <BackButton
                onClick={() => {
                  if (routeQuery) return setRouteQuery("");
                  if (arrivals && arrivalsTab === "routes") return dismissArrivals(false);
                  clearSelectedRoute();
                }}
              />
              <div className={styles.topBarSearchInput}>
                <SearchInput
                  value={routeQuery}
                  onChange={handleRouteQueryChange}
                  placeholder="Search routes"
                  onClear={() => setRouteQuery("")}
                />
              </div>
            </div>
          ) : activeTab === "favorites" && arrivals && arrivalsTab === activeTab ? (
            <div className={styles.topBarSearch}>
              <BackButton onClick={() => dismissArrivals()} />
              {currentStop && (
                <span className={styles.trackingLabel}>
                  {favorites.find(f => f.stop_id === currentStop.id)?.custom_name || currentStop.name || `Stop #${currentStop.id}`}
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
          ) : activeTab === "favorites" || activeTab === "settings" || activeTab === "announcements" ? null : (
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
                <PanelHeader
                  backLabel="Back to map"
                  onBack={exitTracking}
                  title={`Route ${busLocation.route_short_name} — ${busLocation.headsign}`}
                />
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <BusTrackingMap
                  {...trackingMapProps}
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
              {...routeMapProps}
              onSelectStop={(stopId) => handleFetchArrivals(stopId, "routes")}
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
          <MobileOverlay className={styles.mobileTrackingOverlay}>
            <div className={styles.topBar}>
              <PanelHeader
                backLabel="Back to arrivals"
                onBack={exitTracking}
                title={`Route ${busLocation.route_short_name} — ${busLocation.headsign}`}
              />
            </div>
            <div style={{ flex: 1, height: 0 }}>
              <BusTrackingMap
                {...trackingMapProps}
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
          </MobileOverlay>
        )}
      </ErrorBoundary>

      {/* Mobile route-map overlay */}
      <ErrorBoundary>
        {isMobile && routeMapView && selectedRoute && (
          <MobileOverlay>
            <div className={styles.topBar}>
              <PanelHeader
                backLabel="Back to stops"
                onBack={() => setRouteMapView(false)}
                title={`Route ${selectedRoute.route_short_name} — ${selectedRoute.route_long_name}`}
              />
            </div>
            <div style={{ flex: 1, height: 0 }}>
              <RouteMap
                {...routeMapProps}
                onSelectStop={(stopId) => {
                  setRouteMapView(false);
                  handleFetchArrivals(stopId, "routes");
                }}
              />
            </div>
          </MobileOverlay>
        )}
      </ErrorBoundary>

      {/* Nav */}
      <nav className={styles.bottomNav}>
        <div className={styles.brandMark}>
          <img src="/dabus-icon.png" alt="" role="presentation" />
        </div>
        <button
          className={`${styles.navBtn} ${activeTab === "nearby" ? styles.active : ""}`}
          aria-current={activeTab === "nearby" ? "page" : undefined}
          onClick={goHome}
        >
          <svg
            aria-hidden="true"
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
          aria-current={activeTab === "routes" ? "page" : undefined}
          onClick={() => switchTab("routes")}
        >
          <svg
            aria-hidden="true"
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
          className={`${styles.navBtn} ${activeTab === "favorites" ? styles.active : ""}`}
          aria-current={activeTab === "favorites" ? "page" : undefined}
          onClick={() => switchTab("favorites")}
        >
          <svg
            aria-hidden="true"
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
          className={`${styles.navBtn} ${activeTab === "announcements" ? styles.active : ""}`}
          aria-current={activeTab === "announcements" ? "page" : undefined}
          onClick={() => switchTab("announcements")}
        >
          <span className={styles.navIconWrap}>
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
            {announcementsUnread > 0 && activeTab !== "announcements" && (
              <span className={styles.navDot} aria-hidden="true" />
            )}
          </span>
          <span>
            News
            {announcementsUnread > 0 && activeTab !== "announcements" && (
              <span className={styles.srOnly}>, {announcementsUnread} new</span>
            )}
          </span>
        </button>

        <button
          className={`${styles.navBtn} ${activeTab === "settings" ? styles.active : ""}`}
          aria-current={activeTab === "settings" ? "page" : undefined}
          onClick={() => switchTab("settings")}
        >
          <svg
            aria-hidden="true"
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

      {editingFavorite && (
        <SaveStopModal
          stop={{ id: editingFavorite.stop_id, name: editingFavorite.name }}
          title="Rename favorite"
          initialName={editingFavorite.custom_name}
          onSave={(customName) => {
            renameFavorite(editingFavorite.stop_id, customName);
            setEditingFavorite(null);
            showToast("Favorite renamed");
          }}
          onCancel={() => setEditingFavorite(null)}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title={confirmClear === "history" ? "Clear recent stops?" : "Clear all favorites?"}
          message={
            confirmClear === "history"
              ? `This removes ${stopHistory.length} recent ${stopHistory.length === 1 ? "stop" : "stops"}. This can't be undone.`
              : `This removes ${favorites.length} saved ${favorites.length === 1 ? "stop" : "stops"}. This can't be undone.`
          }
          confirmLabel={confirmClear === "history" ? "Clear recents" : "Clear favorites"}
          onConfirm={() => {
            if (confirmClear === "history") {
              clearHistory();
              showToast("Recents cleared", "remove");
            } else {
              clearFavorites();
              showToast("Favorites cleared", "remove");
            }
            setConfirmClear(null);
          }}
          onCancel={() => setConfirmClear(null)}
        />
      )}

      {showRecentSheet && (
        <RecentStopsSheet
          stopHistory={stopHistory}
          onSelectStop={selectRecentStop}
          onRemoveStop={removeFromHistory}
          onClose={() => setShowRecentSheet(false)}
        />
      )}

      {/* Both toast slots live inside always-mounted live regions: screen
          readers often skip announcements when the aria-live element is
          inserted together with its content (WCAG 4.1.3), so the wrappers
          persist and only the message comes and goes. Toast is
          position:fixed — the empty wrappers have no visual footprint. */}
      <div role="status" aria-live="polite">
        {toast && <Toast message={toast} type={toastType} fading={toastFading} />}
      </div>

      {/* Persistent until tapped; sits above the regular toast slot so the
          two never overlap. Reload fetches the new index.html (the service
          worker passes navigations through network-first). */}
      <div role="status" aria-live="polite">
        {updateAvailable && (
          <Toast
            message="Update available — tap to refresh"
            type="info"
            fading={false}
            bottom="130px"
            onClick={() => window.location.reload()}
          />
        )}
      </div>
    </div>
  );
}

export default App;
