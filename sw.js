const CACHE = 'neo-shell-v__NÉO_VERSION__';
const SHELL = __SHELL__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('neo-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // Réseau d'abord : on ne sert jamais un vieux fichier mélangé à une nouvelle page.
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
