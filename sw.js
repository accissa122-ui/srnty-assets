/* Service Worker - أصول سيرينتي
   غيّر رقم VERSION عند كل تحديث كبير عشان الكاش القديم يتمسح. */
const VERSION = 'v1';
const CACHE = 'srnty-assets-' + VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// مكتبات خارجية بيحتاجها الموقع (بنخزّنها عشان يفتح بدون نت)
const CDN = [
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap'
];

const CDN_HOSTS = [
  'www.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com',
  'fonts.googleapis.com', 'fonts.gstatic.com'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await Promise.all(CDN.map(async (u) => {
      try {
        const res = await fetch(new Request(u, { mode: 'no-cors' }));
        await cache.put(u, res);
      } catch (_) { /* لو فشل واحد مش مشكلة، هيتخزن أول ما يتحمّل */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('srnty-assets-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // صفحات الموقع: الشبكة أولاً (عشان التحديثات توصل)، ولو مفيش نت نرجع للنسخة المخزّنة
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', res.clone());
        return res;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // ملفات الموقع نفسه + المكتبات والخطوط: من الكاش فوراً وتتحدّث في الخلفية
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin || CDN_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const refresh = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await refresh) || Response.error();
    })());
  }
  // أي طلبات تانية (Firestore / Auth) بتعدّي مباشرة بدون تدخل
});
