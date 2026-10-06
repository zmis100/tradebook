/* 트레이드북 서비스워커 — 앱 셸 캐시 (오프라인 지원). 코드 수정 후 배포 시 CACHE 버전 올리기 */
const CACHE = 'tradebook-v1';
const SHELL = ['./', './index.html', './style.css', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './js/stocks.js', './js/core.js', './js/sync.js', './js/charts.js', './js/cards.js', './js/ai.js', './js/forms.js', './js/views.js', './js/app.js'];
const CDN = ['https://cdnjs.cloudflare.com/', 'https://cdn.jsdelivr.net/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 앱 셸·CDN(폰트, 캡처 라이브러리): 네트워크 우선, 실패 시 캐시. API 요청(Supabase·Gemini)은 그대로 통과.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const cacheable = e.request.method === 'GET' && (url.origin === location.origin || CDN.some(p => e.request.url.startsWith(p)));
  if (!cacheable) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
