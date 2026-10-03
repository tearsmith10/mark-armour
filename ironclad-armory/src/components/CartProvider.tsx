"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type CartLine = {
  slug: string;
  name: string;
  category: string;
  price_cents: number;
  quantity: number;
};

type CartContextValue = {
  items: CartLine[];
  ready: boolean;
  signedIn: boolean;
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "quantity">, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  /** epoch ms of the last time a server snapshot was adopted (null = never). */
  lastSyncedAt: number | null;
};

const STORAGE_KEY = "ironclad-cart-v1";
/** How often the server cart is re-fetched while signed in and visible. */
const SYNC_INTERVAL_MS = 4000;
/** Server snapshots are ignored for this long after a local edit so the 400ms
 *  debounced PUT can land first — a poll can never clobber fresh input. */
const LOCAL_EDIT_GRACE_MS = 2500;

const CartContext = createContext<CartContextValue | null>(null);

function readLocal(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Order-insensitive fingerprint of slug+quantity — used to skip no-op updates. */
function cartSignature(lines: CartLine[]): string {
  const pairs = lines.map((l) => [l.slug, l.quantity] as [string, number]);
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify(pairs);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedInRef = useRef(false);
  const itemsRef = useRef<CartLine[]>([]);
  const lastLocalEdit = useRef(0);
  const inFlight = useRef(false);

  // itemsRef always mirrors the last committed state (read by the poll diff).
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const pushToServer = useCallback((next: CartLine[]) => {
    if (!signedInRef.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: next.map((l) => ({ slug: l.slug, qty: l.quantity })) }),
      }).catch(() => {});
    }, 400);
  }, []);

  /**
   * GET /api/cart and adopt the result — the POLL path only. It never writes
   * back to the server, so a poll can't echo a PUT and create a loop.
   * Skips when: a request is already running, the local edit is newer than the
   * snapshot (< 2.5s), a debounced push is still queued, or the snapshot is
   * identical to what we already have (slug+qty compare).
   */
  const fetchServerCart = useCallback(async () => {
    if (!signedInRef.current) return;
    if (inFlight.current) return; // no overlapping requests
    inFlight.current = true;
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (res.status === 401) {
        signedInRef.current = false;
        setSignedIn(false);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { items?: CartLine[] };
      const snapshot = Array.isArray(data.items) ? data.items : [];

      if (Date.now() - lastLocalEdit.current < LOCAL_EDIT_GRACE_MS) return; // local wins
      if (syncTimer.current !== null) return; // push still queued — local wins
      if (cartSignature(snapshot) === cartSignature(itemsRef.current)) return; // no change, no render

      itemsRef.current = snapshot;
      setItems(snapshot);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        /* ignore quota errors */
      }
      setLastSyncedAt(Date.now());
    } catch {
      /* offline — keep the local cart */
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Hydrate from localStorage, then merge with the server-side cart if signed in.
  useEffect(() => {
    const local = readLocal();
    itemsRef.current = local;
    setItems(local);
    setReady(true);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cart");
        if (!res.ok) return;
        const data = (await res.json()) as { items: CartLine[] };
        if (cancelled) return;
        signedInRef.current = true;
        setSignedIn(true);

        const merged = new Map<string, CartLine>();
        for (const l of data.items) merged.set(l.slug, { ...l });
        for (const l of local) {
          const existing = merged.get(l.slug);
          // Reconcile, never add — the same cart seen twice must not grow.
          if (existing) existing.quantity = Math.min(10, Math.max(existing.quantity, l.quantity));
          else merged.set(l.slug, l);
        }
        const mergedArr = [...merged.values()];
        // The merge is a local change: stamp it so the first poll can't adopt
        // the pre-PUT server state before our push lands.
        lastLocalEdit.current = Date.now();
        itemsRef.current = mergedArr;
        setItems(mergedArr);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedArr));
        setLastSyncedAt(Date.now());
        // Only push when local state actually contributed something. A
        // no-op push here is a wipe hazard: a backgrounded tab can hydrate
        // against an empty server, queue a debounced `PUT []`, and have that
        // timer resume minutes later — after another device has added items.
        if (cartSignature(mergedArr) !== cartSignature(data.items)) {
          pushToServer(mergedArr);
        }
      } catch {
        /* not signed in / offline — local cart only */
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Cross-device sync: while signed in and visible, pull the server cart.
   *  GET-only — pushes happen exclusively in the local mutations below. */
  useEffect(() => {
    if (!signedIn) return;

    const refresh = () => {
      if (document.visibilityState === "visible") void fetchServerCart();
    };

    refresh(); // immediate catch-up after sign-in
    const timer = setInterval(refresh, SYNC_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [signedIn, fetchServerCart]);

  const update = useCallback(
    (next: CartLine[]) => {
      lastLocalEdit.current = Date.now();
      itemsRef.current = next;
      setItems(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      pushToServer(next);
    },
    [pushToServer],
  );

  const add = useCallback(
    (line: Omit<CartLine, "quantity">, qty = 1) => {
      lastLocalEdit.current = Date.now();
      setItems((prev) => {
        const next = [...prev];
        const idx = next.findIndex((l) => l.slug === line.slug);
        if (idx >= 0) next[idx] = { ...next[idx], quantity: Math.min(10, next[idx].quantity + qty) };
        else next.push({ ...line, quantity: Math.min(10, qty) });
        itemsRef.current = next;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        pushToServer(next);
        return next;
      });
    },
    [pushToServer],
  );

  const setQty = useCallback(
    (slug: string, qty: number) => {
      lastLocalEdit.current = Date.now();
      setItems((prev) => {
        const next =
          qty <= 0
            ? prev.filter((l) => l.slug !== slug)
            : prev.map((l) => (l.slug === slug ? { ...l, quantity: Math.min(10, qty) } : l));
        itemsRef.current = next;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        pushToServer(next);
        return next;
      });
    },
    [pushToServer],
  );

  const remove = useCallback((slug: string) => setQty(slug, 0), [setQty]);

  const clear = useCallback(() => update([]), [update]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, l) => n + l.quantity, 0);
    const subtotal = items.reduce((n, l) => n + l.quantity * l.price_cents, 0);
    return { items, ready, signedIn, count, subtotal, add, setQty, remove, clear, lastSyncedAt };
  }, [items, ready, signedIn, lastSyncedAt, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
