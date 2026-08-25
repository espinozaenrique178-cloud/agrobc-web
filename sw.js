// AgroBC — service worker
//
// Estrategia: network-first. Siempre intenta traer la versión más nueva
// de la red primero; solo si no hay conexión usa lo que tenga guardado.
// Así, cuando se actualiza la app, la próxima vez que se abre (con
// internet) se ve el cambio nuevo automáticamente — nunca se queda
// atorada en una versión vieja de caché.
//
// Las llamadas a Supabase (datos de productos, login, etc.) nunca pasan
// por este service worker: se ignoran por completo más abajo, así que
// siempre van directo a la red, en tiempo real.

const CACHE_NAME = 'agrobc-shell-v1';

const APP_SHELL = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './supabase-config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

function isSupabaseRequest(url) {
  return url.hostname.endsWith('.supabase.co');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo GET, solo nuestro propio origen, y jamás nada de Supabase:
  // esas peticiones se dejan pasar intactas, sin caché, siempre en vivo.
  if (request.method !== 'GET' || url.origin !== self.location.origin || isSupabaseRequest(url)) {
    return;
  }

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}
