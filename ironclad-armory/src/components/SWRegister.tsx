"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js and drives the update flow.
 *
 * - Production only: in dev the service worker would serve stale compiled
 *   assets, so registration is skipped unless NODE_ENV === "production".
 * - Reload only happens on `controllerchange` when the page ALREADY had a
 *   controller (captured before any worker claims us) — a first-time install
 *   claims clients but never reloads the page the user is looking at.
 * - When a new worker finishes installing behind an existing one, we tell it
 *   to SKIP_WAITING (public/sw.js waits on install by design), and the
 *   controllerchange reload keeps page + worker versions in lockstep.
 */
export default function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              // New worker installed behind a controlling one → activate it now.
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                installing.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => {
          /* offline or unsupported — the app still works without the SW */
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
