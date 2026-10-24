// Offline cache for Mythmaker Studio. After one visit online (and one AI model
// download), the app opens and chats with no WiFi or data. WebLLM keeps the model
// in its own caches; this worker never touches those.
const VERSION = 'mythmaker-shell-v1';
const CORE = ['./', './index.html', './app.js', './starters.js', './style.css', './firebase-config.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const RUNTIME_HOSTS = ['esm.run', 'cdn.jsdelivr.net'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mythmaker-shell-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const own = url.origin === self.location.origin;
  if (!own && !RUNTIME_HOSTS.includes(url.hostname)) return;
  if (own && request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); }
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // App files: network first so updates arrive, cache when offline. Library files: cache first.
  const network = () => fetch(request).then((response) => {
    if (response && (response.ok || response.type === 'opaque')) {
      const copy = response.clone(); caches.open(VERSION).then((c) => c.put(request, copy));
    }
    return response;
  });
  event.respondWith(own
    ? network().catch(() => caches.match(request, { ignoreSearch: true }))
    : caches.match(request).then((cached) => cached || network()));
});
