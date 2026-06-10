import { useState } from "react";

// Toast lifecycle: fully visible until TOAST_FADE_MS, fading until
// TOAST_GONE_MS, then removed.
// NOTE: the Android back-button exit window (EXIT_WINDOW_MS in App.jsx) must
// stay equal to TOAST_GONE_MS — back exits only while the toast is on screen.
export const TOAST_FADE_MS = 2000;
export const TOAST_GONE_MS = 3200;

export function useToast() {
  const [toast, setToast] = useState(null);
  const [toastFading, setToastFading] = useState(false);
  const [toastType, setToastType] = useState("add");

  const showToast = (message, type = "add") => {
    setToast(message);
    setToastType(type);
    setToastFading(false);
    setTimeout(() => setToastFading(true), TOAST_FADE_MS);
    setTimeout(() => setToast(null), TOAST_GONE_MS);
  };

  return { toast, toastType, toastFading, showToast };
}
