const CACHE_PREFIX = "pt-coach-";
const CACHE_NAME = `${CACHE_PREFIX}v5`;
// Caminhos com placeholder __BASE__ — substituído em build pelo plugin
// pwaBaseTransform definido em vite.config.js. Em prod resolve para "/",
// em dev (Caddy proxy) resolve para "/pt/".
const APP_SHELL = [
  "__BASE__",
  "__BASE__index.html",
  "__BASE__manifest.json",
  "__BASE__icons/icon.svg",
  "__BASE__icons/icon-192.png",
  "__BASE__icons/icon-512.png",
  "__BASE__icons/icon-512-maskable.png",
  "__BASE__icons/apple-touch-icon.png",
];

async function getBuildAssets() {
  const response = await fetch("__BASE__index.html", { cache: "no-cache" });
  const html = await response.text();
  const assets = new Set(APP_SHELL);
  const assetPattern = /(?:src|href)="([^"]+)"/g;

  for (const match of html.matchAll(assetPattern)) {
    const assetPath = match[1];
    if (!assetPath.startsWith("__BASE__")) continue;
    if (assetPath.startsWith("__BASE__sw.js")) continue;
    assets.add(assetPath);
  }

  return Array.from(assets);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const assets = await getBuildAssets();
    // allSettled: se um asset falhar (404 transitório), instalação continua
    await Promise.allSettled(assets.map((url) => cache.add(url)));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldCaches = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME);
    // Detectar se este activate é um UPGRADE (havia caches anteriores) ou
    // a primeira instalação (nenhum cache antigo). Só fazemos broadcast em
    // upgrade — senão usuária nova veria "Nova versão disponível" na primeira
    // visita, falso positivo.
    const isUpgrade = oldCaches.length > 0;
    await Promise.all(oldCaches.map((key) => caches.delete(key)));
    await self.clients.claim();
    if (isUpgrade) {
      const clientList = await self.clients.matchAll({ type: "window" });
      clientList.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
    }
  })());
});

self.addEventListener("message", (event) => {
  // Permite que o client force a troca de um SW pendente (ex.: usuário
  // clicou em "Atualizar agora" no UpdateBanner).
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Estrategia de cache: NETWORK-FIRST com fallback para cache em erro de rede.
// Implicacao para "sempre atualizar online":
//   - Toda requisicao GET de mesma origem (exceto /api/**) tenta fetch() primeiro.
//   - Se rede responde, cacheia a versao nova e devolve. Cache antigo eh sobrescrito.
//   - Se rede falha (offline ou 5xx ao nivel de network), serve cache como fallback.
//   - /api/** nunca passa pelo SW — eh dinamico (Firebase Function).
// Combinado com:
//   - Headers no-cache em /index.html, /manifest.json, /sw.js (firebase.json)
//   - registration.update() periodico no client (index.html)
//   - Bundle assets com hash imutavel (Vite)
// O resultado eh que uma aba online jamais serve conteudo stale por mais de
// alguns segundos apos um deploy.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // /api/** eh dinamico (Firebase Function) — nunca cachear.
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
        || (await cache.match("__BASE__index.html"))
        || Response.error();
    }
  })());
});
