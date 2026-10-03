/* mark-armour service worker — hand-written, no build step.
 *
 * Cache strategy (versioned: bump VERSION to invalidate everything):
 *   (a) Navigation requests ...... network-first → cached page → /offline.html
 *   (b) Same-origin static assets  stale-while-revalidate (cache-first offline)
 *   (c) /api/* ................... NEVER cached — network only, so carts, auth
 *       and checkout are always live on every device.
 *   (d) Cross-origin images ....... stale-while-revalidate, ~80-entry LRU cap
 *   (e) install → precache /, /products, /cart, /offline.html, manifest, icons
 *       activate → delete stale versioned caches + clients.claim()
 *
 * skipWaiting() policy (deliberate): NOT called on install. An updated worker
 * waits until every tab of the previous version is closed, so a page is never
 * half-old/half-new. SWRegister.tsx posts { type: "SKIP_WAITING" } only when
 * it detects a waiting worker during an explicit update, and reloads the page
 * once on `controllerchange` (only if the page already had a controller).
 */

const VERSION = "mark-armour-v1";
const IMAGE_CACHE = VERSION + "-images";
const IMAGE_LIMIT = 80; // approximate LRU cap for cross-origin product photos

const PRECACHE = [
  "/",
  "/products",
  "/cart",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // Add individually: one failing URL must not fail the whole install.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
      // No automatic skipWaiting() — see the header comment.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([VERSION, IMAGE_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.indexOf("mark-armour-") === 0 && !keep.has(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // PUT/POST/DELETE always hit the network

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // (c) API routes — network only. Carts, auth and checkout stay live.
  if (url.pathname.indexOf("/api/") === 0) return;

  // App Router data requests (RSC payloads) — always live so client-side
  // navigation never reads a stale cached fragment.
  if (req.headers.get("RSC") === "1") return;

  // (a) Page navigations — network first.
  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(event, req));
    return;
  }

  // (b) Same-origin static assets — cache first, revalidate in background.
  if (url.origin === self.location.origin) {
    event.respondWith(handleSameOrigin(event, req));
    return;
  }

  // (d) Cross-origin images (product photography) — SWR with an LRU cap.
  if (req.destination === "image") {
    event.respondWith(handleCrossOriginImage(event, req));
  }
});

/** (a) network-first navigation → cached page → offline.html */
async function handleNavigation(event, req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(VERSION);
      event.waitUntil(cache.put(req, res.clone()).catch(() => {}));
    }
    return res;
  } catch {
    const cached = (await caches.match(req, { ignoreSearch: true })) ||
      (await caches.match(new URL(req.url).pathname, { ignoreSearch: true }));
    if (cached) return cached;
    const offline = await caches.match("/offline.html");
    if (offline) return offline;
    return new Response("You are offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/** (b) same-origin assets — stale-while-revalidate */
async function handleSameOrigin(event, req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);

  const refresh = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh); // background revalidate
    return cached;
  }
  const net = await refresh;
  if (net) return net;
  const offline = await caches.match("/offline.html");
  return offline || Response.error();
}

/** (d) cross-origin images — stale-while-revalidate with an approximate LRU cap */
async function handleCrossOriginImage(event, req) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(req);

  const refresh = fetch(req)
    .then(async (res) => {
      // Opaque (no-CORS) responses report ok=false but are still cacheable.
      if (res && (res.ok || res.type === "opaque")) {
        await cache.put(req, res.clone()).catch(() => {});
        await trimCache(cache, IMAGE_LIMIT, req.url);
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const net = await refresh;
  return net || Response.error();
}

/** Approximate LRU: browsers iterate cache keys in insertion order, so drop the
 *  oldest entries first (never the URL that was just stored). */
async function trimCache(cache, limit, keepUrl) {
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  let excess = keys.length - limit;
  for (const key of keys) {
    if (excess <= 0) break;
    if (key.url === keepUrl) continue;
    if (await cache.delete(key)) excess--;
  }
}
