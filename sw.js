const CACHE_NAME = 'hsk4-v20';
const ASSETS = [
  '/',
  '/index.html',
  '/data/testSets.json',
  '/data/secretNotes.json',
  '/data/hskWords.json',
  '/data/mockGenerator.js'
];

self.addEventListener('install', e => {
  // 즉시 활성화 - 이전 SW 대기하지 않음
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  // 모든 구 캐시 삭제 + 즉시 클라이언트 제어
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network first, fallback to cache
self.addEventListener('fetch', e => {
  // HTML/JS는 항상 네트워크 우선
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
