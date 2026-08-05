// ── LAMSANG Service Worker ──
// ⚠️ เวลาแก้ app.css / app.js ต้อง bump ทั้ง ASSET_VER ที่นี่
//    และ ?v= ใน index.html ให้ตรงกัน ไม่งั้นลูกค้าจะได้ไฟล์เก่าค้าง
//    (asset เป็น cache-first — ต่างจาก HTML ที่เป็น network-first)
const ASSET_VER = '48';
const CACHE = 'lamsang-v' + ASSET_VER;  // ← bump version ทุกครั้งที่ deploy ใหม่
const PRECACHE = [
  './',
  './index.html',
  './admin.html',
  './firebase-config.js',
  './manifest.json',
  './app.css?v=' + ASSET_VER,
  './app.js?v=' + ASSET_VER,
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase, Cloudinary, googleapis — network only
  if (url.includes('firebasedatabase') ||
      url.includes('cloudinary') ||
      url.includes('googleapis') ||
      url.includes('gstatic')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // HTML files — network first (ได้ไฟล์ใหม่เสมอ)
  if (e.request.headers.get('accept')?.includes('text/html') ||
      url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets (JS, CSS, images) — cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
