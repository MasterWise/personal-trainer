const CACHE_PREFIX = "pt-coach-";
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const APP_SHELL = ["/pt/", "/pt/index.html", "/pt/manifest.json", "/pt/icons/icon.svg"];

async function getBuildAssets() {
  const response = await fetch("/pt/index.html", { cache: "no-cache" });
  const html = await response.text();
  const assets = new Set(APP_SHELL);
  const assetPattern = /(?:src|href)="([^"]+)"/g;

  for (const match of html.matchAll(assetPattern)) {
    const assetPath = match[1];
    if (!assetPath.startsWith("/pt/")) continue;
    if (assetPath.startsWith("/pt/sw.js")) continue;
    assets.add(assetPath);
  }

  return Array.from(assets);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const assets = await getBuildAssets();
    await cache.addAll(assets);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const clone = response.clone();
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        );
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(request))
        || (await cache.match("/pt/index.html"))
        || Response.error();
    }
  })());
});
