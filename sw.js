/* ChristoDay service worker — precache shell + plan for offline weekday use.
   Bible live text stays network-only. */
const CACHE = "christoday-2026.07.24.5";
const PRECACHE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/version.js",
  "./js/schedule.js",
  "./js/bible.js",
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
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache third-party Bible API
  if (url.hostname === "bolls.life" || url.hostname.includes("fonts.")) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
