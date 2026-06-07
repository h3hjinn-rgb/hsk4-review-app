const CACHE_NAME = 'hsk4-v21';
const ASSETS = [
  '/',
  '/index.html',
  '/data/testSets.json',
  '/data/secretNotes.json',
  '/data/hskWords.json',
  '/data/mockGenerator.js'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network first - always try network, only fallback to cache when offline
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// Listen for message to force clear cache
self.addEventListener('message', e => {
  if (e.data === 'FORCE_UPDATE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
      self.registration.unregister().then(() => {
        e.source.postMessage('CLEARED');
      });
    });
  }
});
