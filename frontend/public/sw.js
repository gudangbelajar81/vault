// Simple Service Worker for PWA Installation Support

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // We just let the browser handle all network requests normally.
  // This satisfies the PWA installability criteria without adding complex caching.
  event.respondWith(fetch(event.request));
});
