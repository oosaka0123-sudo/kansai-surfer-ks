const CACHE_NAME = 'ks-pwa-v1020';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/nami_common.css?v=1018',
  '/nami_common.js?v=1018',
  '/img/logo-ks-white.png',
  '/img/favicon.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/icon-192-maskable.png',
  '/img/icon-512-maskable.png'
];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
      )
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // HTMLは常にネット優先
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }
  // JSONも常に最新取得
  if (
    url.pathname.includes('/data/') ||
    url.pathname.includes('/blog/articles.json') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }
  // CSS・JS・画像だけキャッシュ
  event.respondWith(
    caches.match(event.request).then(cache => {
      return cache || fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
