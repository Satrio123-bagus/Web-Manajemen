// ─── INSERT3COINS Service Worker ───────────────────────────────────────────
// Versi: 1.0.0
// Strategi: Cache-First untuk aset statis, Network-First untuk API.
// Tujuan: Agar app bisa di-install sebagai PWA dan loading terasa lebih cepat.

const CACHE_NAME = 'i3c-cache-v1';

// Hanya cache '/' sebagai App Shell — SPA route seperti '/terminal' bukan file statis
const PRECACHE_ASSETS = ['/'];

// ─── INSTALL: Pre-cache app shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Paksa SW baru mengambil alih langsung tanpa menunggu refresh
  self.skipWaiting();
});

// ─── ACTIVATE: Hapus cache lama ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Ambil alih semua tab yang terbuka sekarang
  self.clients.claim();
});

// ─── FETCH: Strategi caching per jenis request ─────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Jangan cache API calls (selalu dari network)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-First untuk aset statis (CSS, JS, gambar, font)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Network-First dengan fallback ke cache untuk navigasi (SPA routing)
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});
