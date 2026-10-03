"use client";

import { useEffect, useState } from "react";

/**
 * PWA install flow, shared by the floating bottom card (InstallPrompt) and the
 * "Install now" button on /app (InstallNowButton).
 *
 * - Captures `beforeinstallprompt` in a module-level store so both components
 *   drive the ONE deferred prompt (a prompt may only be shown once).
 * - iOS Safari never fires `beforeinstallprompt`: when the UA is iOS Safari and
 *   we're not standalone, we show Share → Add to Home Screen instructions.
 * - Dismissals (and successful installs) suppress the card for 7 days via
 *   localStorage. Already-installed (standalone) sessions never see it.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

const DISMISS_KEY = "mark-armour-install-dismissed";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let listening = false;

function notify() {
  for (const l of listeners) l();
}

function ensureListening() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // suppress the browser's mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    markInstallDismissed(); // hide the card for 7 days after install
    notify();
  });
}

export function markInstallDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode / quota — fail open */
  }
}

function recentlyDismissed(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(ts) && ts > 0 && Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const displayMode =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;
  return displayMode || nav.standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ identifies as Mac but is touch-first.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Runs the deferred prompt. Returns true when the user accepted. */
async function runInstall(): Promise<boolean> {
  const ev = deferred;
  if (!ev) return false;
  deferred = null;
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice?.outcome === "accepted") markInstallDismissed();
    return choice?.outcome === "accepted";
  } catch {
    return false;
  } finally {
    notify();
  }
}

type Availability = {
  ready: boolean;
  canPrompt: boolean;
  ios: boolean;
  standalone: boolean;
  dismissed: boolean;
};

const HIDDEN: Availability = {
  ready: false,
  canPrompt: false,
  ios: false,
  standalone: false,
  dismissed: false,
};

/** Availability is computed only after mount to keep SSR/hydration identical. */
function useAvailability(): Availability {
  const [state, setState] = useState<Availability>(HIDDEN);
  useEffect(() => {
    ensureListening();
    const update = () =>
      setState({
        ready: true,
        canPrompt: Boolean(deferred),
        ios: isIOS(),
        standalone: isStandalone(),
        dismissed: recentlyDismissed(),
      });
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return state;
}

/** Floating card: Android/desktop install button or iOS instructions. */
export default function InstallPrompt() {
  const s = useAvailability();

  if (!s.ready || s.standalone || s.dismissed) return null;
  const canInstall = s.canPrompt;
  const showIOS = s.ios && !s.canPrompt;
  if (!canInstall && !showIOS) return null;

  const dismiss = () => {
    markInstallDismissed();
    notify();
  };

  return (
    <div
      role="dialog"
      aria-label="Install the mark-armour app"
      className="fixed inset-x-3 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-50 md:inset-x-auto md:bottom-6 md:right-6 md:w-[23rem]"
    >
      <div className="card relative flex gap-3 border border-ink-600 bg-ink-900/95 p-4 backdrop-blur-md">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center bg-blaze-500 font-black text-onbrand"
        >
          MA
        </span>

        <div className="min-w-0 pr-6">
          <p className="font-display text-xs font-black uppercase tracking-widest text-stone-100">
            Install the mark-armour app
          </p>
          <p className="mt-1 text-xs leading-relaxed text-stone-400">
            Shop faster — cart syncs instantly with the web.
          </p>

          {canInstall ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void runInstall()}
                className="btn-primary !px-4 !py-2 !text-[10px]"
              >
                Install
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="text-[10px] font-bold uppercase tracking-widest text-stone-500 transition-colors hover:text-stone-300"
              >
                Not now
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-olive-400">
                On iPhone / iPad
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stone-400">
                Tap <span className="font-bold text-stone-200">Share</span> in Safari →{" "}
                <span className="font-bold text-stone-200">Add to Home Screen</span>.
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="mt-2 text-[10px] font-bold uppercase tracking-widest text-stone-500 transition-colors hover:text-stone-300"
              >
                Got it
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center text-sm text-stone-500 transition-colors hover:text-stone-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * Big CTA for the /app guide page — reuses the exact same deferred prompt.
 * Falls back to per-platform instructions when the browser can't prompt.
 */
export function InstallNowButton({ className = "btn-primary" }: { className?: string }) {
  const s = useAvailability();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "ios" | "manual">("idle");

  const onClick = async () => {
    if (s.canPrompt) {
      setStatus("working");
      setStatus((await runInstall()) ? "done" : "manual");
    } else {
      setStatus(s.ios ? "ios" : "manual");
    }
  };

  if (s.standalone) {
    return (
      <p className="text-sm font-bold uppercase tracking-widest text-olive-400">
        ✓ Already installed — you&apos;re running the app
      </p>
    );
  }

  return (
    <div className="w-full max-w-md">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={status === "working" || status === "done"}
        className={`${className} w-full sm:w-auto`}
      >
        {status === "done"
          ? "App installed ✓"
          : status === "working"
            ? "Opening installer…"
            : "Install now"}
      </button>

      {status === "ios" && (
        <p className="mt-3 rounded-none border border-ink-600 bg-ink-900 p-4 text-sm leading-relaxed text-stone-300">
          <span className="font-bold uppercase tracking-widest text-blaze-400">iPhone / iPad:</span>{" "}
          tap the <span className="font-bold text-stone-100">Share</span> button in Safari
          (square with the upward arrow), scroll down and tap{" "}
          <span className="font-bold text-stone-100">Add to Home Screen</span>, then{" "}
          <span className="font-bold text-stone-100">Add</span>.
        </p>
      )}

      {status === "manual" && (
        <p className="mt-3 rounded-none border border-ink-600 bg-ink-900 p-4 text-sm leading-relaxed text-stone-300">
          Your browser didn&apos;t offer a one-tap install — open the browser menu and choose{" "}
          <span className="font-bold text-stone-100">Install app</span> or{" "}
          <span className="font-bold text-stone-100">Add to Home Screen</span>.
        </p>
      )}
    </div>
  );
}
