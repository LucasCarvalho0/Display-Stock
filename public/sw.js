// DISPLAY STOCK — Service Worker (PWA)
const CACHE_NAME = 'display-stock-v6';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.jpg',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/icon.svg',
  '/apple-touch-icon.png',
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Alguns assets estáticos não foram cacheados no install:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de caches obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de Fetch:
// - Requisições para APIs (/api/*) e métodos não-GET: Network Only (sempre dados reais do banco)
// - Navegações e páginas: Network First com fallback para cache
// - Assets estáticos (imagens, ícones): Cache First com fallback de rede
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Apenas tratar requisições GET
  if (req.method !== 'GET') {
    return;
  }

  // APIs do banco de dados NUNCA devem ser cacheadas para garantir saldos reais
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Para imagens e ícones estáticos: Cache First
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|webp)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Para páginas e navegações: Network First (prioriza tela viva e atualizada)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match(req).then((cached) => {
          return cached || caches.match('/');
        });
      })
    );
  }
});

