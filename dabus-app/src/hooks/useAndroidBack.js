import { useEffect, useRef } from "react";
import { TOAST_GONE_MS } from "./useToast";

/**
 * Android PWA system-back interception.
 *
 * Hard-won architecture — this took four on-device iterations to get right.
 * The core constraint: Chrome treats history entries pushed WITHOUT user
 * activation as transparent. The system back button falls straight through
 * them and closes the PWA. pushState from a popstate handler or a timer is
 * therefore useless for interception; only entries pushed during a real tap
 * count. Do not "simplify" the push discipline below.
 *
 * How it works:
 * - Every real tap (document-level click capture) funds ONE history entry.
 * - Each back press consumes one entry and fires popstate; the handler runs
 *   one in-app back step, never pushing anything itself.
 * - At home base with no guard armed, a back press arms the exit guard and
 *   shows the toast, deliberately leaving history empty — the NEXT press
 *   finds nothing to pop and Android closes the PWA natively.
 *
 * @param {Object}   opts
 * @param {boolean}  opts.isDeep    user is "deeper" than a base tab view
 * @param {boolean}  opts.isHome    the home/base tab is active
 * @param {Function} opts.onBack    performs ONE in-app back step
 *                                  (deeper → shallower → home tab)
 * @param {Function} opts.showToast from useToast
 */
export function useAndroidBack({ isDeep, isHome, onBack, showToast }) {
  const onBackRef = useRef(null);
  const showToastRef = useRef(null);
  const isDeepRef = useRef(false);
  const isHomeRef = useRef(true);
  // true while "press back again to exit" is active
  const exitGuardRef = useRef(false);
  const exitTimerRef = useRef(null);

  // Keep refs current after every render so the popstate listener
  // (registered once) never holds stale closures.
  useEffect(() => {
    onBackRef.current = onBack;
    showToastRef.current = showToast;
    isDeepRef.current = isDeep;
    isHomeRef.current = isHome;
  });

  // Intercept the OS back gesture while inside the app.
  useEffect(() => {
    // Must match the Toast lifecycle: back exits ONLY while some part of the
    // toast is still on screen.
    const EXIT_WINDOW_MS = TOAST_GONE_MS;

    // Push a sentinel so there is at least one history entry behind us.
    // Without it, Android fires no popstate at the start of history — it just
    // closes the PWA silently. Idempotent: checks history.state first, so
    // repeated calls (StrictMode remount, taps, resume) never stack entries.
    const ensureSentinel = () => {
      if (!history.state?.dabusReady) {
        history.pushState({ dabusReady: true }, "");
      }
    };
    ensureSentinel();

    const disarmExit = () => {
      clearTimeout(exitTimerRef.current);
      exitGuardRef.current = false;
    };

    const onPopState = () => {
      if (isDeepRef.current || !isHomeRef.current) {
        // Inside the app — run the in-app back action (deeper → shallower →
        // home tab). We deliberately do NOT pushState here: entries pushed
        // from a popstate handler carry no user activation, so Chrome's
        // history manipulation intervention treats them as transparent — the
        // next back press falls straight through them and closes the PWA.
        // Interception is funded by real taps instead (see onTap below).
        onBackRef.current?.();
        disarmExit();
      } else if (!exitGuardRef.current) {
        // First back at home base — arm the exit guard but do NOT re-push the
        // sentinel. We are now at the start of history, so the next system
        // back press has nothing to pop and Android closes the PWA natively.
        // (popstate fires AFTER the browser pops the entry, so an exit can
        // only happen by leaving no entry for the next press to consume.)
        exitGuardRef.current = true;
        // setTimeout(0) so React can commit the toast before Chrome's back
        // gesture processing interferes with the render.
        setTimeout(() => {
          showToastRef.current?.("Press back again to exit", "info");
        }, 0);
        exitTimerRef.current = setTimeout(() => {
          // Toast fully gone without a second press — re-arm interception.
          exitGuardRef.current = false;
          ensureSentinel();
        }, EXIT_WINDOW_MS);
      } else {
        // Guard armed but popstate still fired — surplus entries exist
        // (non-navigation taps each fund one; see onTap). Keep unwinding;
        // once history is exhausted the next press closes the app.
        history.back();
      }
    };

    // Every real tap funds ONE history entry. Taps are the only moments the
    // page holds user activation, and only activation-backed entries are
    // honored by the system back button (see note in onPopState). Surplus
    // entries from non-navigation taps are harmless: deep states consume one
    // per back press, and leftovers at home are unwound silently by the
    // exit-guard branch above. A tap also means the user is staying, so
    // cancel any pending exit prompt. 'click' (not pointerdown) so that
    // scroll gestures don't fund entries.
    const onTap = () => {
      disarmExit();
      history.pushState({ dabusReady: true }, "");
    };

    // App resumed (PWA from recents / bfcache restore): the mount effect does
    // NOT re-run in these cases, so re-arm interception here.
    const onResume = () => {
      if (document.visibilityState === "visible") {
        disarmExit();
        ensureSentinel();
      }
    };

    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onTap, true);
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onTap, true);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, []);
}
