/* ChristoDay service worker — precache shell + plan for offline weekday use.
   Bible live text stays network-only. */
importScripts("./js/version.js");
const CACHE_PREFIX = "christoday-";
const CACHE = `${CACHE_PREFIX}${self.SITE_VERSION.id}`;
const SCOPE_URL = new URL(self.registration.scope);
const PLAN_URL = new URL("./data/segments.json", SCOPE_URL).href;
const PRECACHE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/version.js",
  "./js/schedule.js",
  "./js/red-letter.js",
  "./js/bible.js",
  "./js/state.js",
  "./js/app.js",
  "./data/segments.json",
  "./manifest.webmanifest",
  "./404.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept third-party requests or same-origin resources owned by
  // another project on the shared GitHub Pages origin.
  if (
    url.origin !== SCOPE_URL.origin ||
    !url.pathname.startsWith(SCOPE_URL.pathname)
  ) {
    return;
  }

  // A stale valid plan must not mask a current invalid/non-200 response.
  // Keep the install-time copy strictly as an offline fallback.
  if (url.href === PLAN_URL) {
    event.respondWith(
      fetch(req).catch(() =>
        caches.open(CACHE).then((cache) => cache.match(req))
      )
    );
    return;
  }

  const cachePromise = caches.open(CACHE);
  const cachedPromise = cachePromise.then((cache) => cache.match(req));
  const networkPromise = Promise.all([cachePromise, cachedPromise]).then(
    ([cache, cached]) => fetch(req)
      .then(async (response) => {
        if (response?.ok) {
          try {
            await cache.put(req, response.clone());
          } catch {
            // A quota/policy cache failure must not discard a valid response.
          }
        }
        return response;
      })
      .catch(() => cached)
  );
  event.respondWith(cachedPromise.then((cached) => cached || networkPromise));
  event.waitUntil(networkPromise.then(() => undefined));
});
