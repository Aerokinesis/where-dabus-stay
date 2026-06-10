import { useState, useEffect } from "react";

// How often to re-check while the app stays open.
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Detects new deployments while the app is running.
 *
 * Compares the build id embedded in this bundle (__BUILD_ID__, see
 * vite.config.js) against /version.json on the server. Checks shortly after
 * load, whenever the app is resumed (visibilitychange — the common case for
 * an installed PWA that lives in memory for days), and hourly.
 *
 * The service worker can't detect these updates: sw.js is static, so its
 * bytes rarely change between deploys and no updatefound event fires.
 */
export function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return; // dev server / offline — never nag
        const { buildId } = await res.json();
        if (!cancelled && buildId && buildId !== __BUILD_ID__) {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline or fetch failed — stay quiet.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    const initialTimer = setTimeout(check, 10_000);
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return updateAvailable;
}
