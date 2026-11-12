const CACHE = 'alex-shell-__ALEX_VERSION__';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/styles.css', '/app.js', '/sim.js', '/dialogue.js', '/collision-map.js', '/navigation.js', '/home.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('alex-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    if (event.request.mode !== 'navigate') {
      const hit = await cache.match(event.request);
      if (hit) return hit;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok || response.type === 'opaque') await cache.put(event.request, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      const fallback = await cache.match(event.request) || (event.request.mode === 'navigate' && await cache.match('/index.html'));
      if (fallback) return fallback;
      throw error;
    }
  }));
});
