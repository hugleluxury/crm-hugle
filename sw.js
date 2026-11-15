// CRM HUGLE · service worker: funciona sin conexión y activa el aislamiento entre orígenes
// (COOP/COEP) para que la IA pueda usar varios hilos aunque el alojamiento no ponga esas cabeceras.
const CACHE = 'crm-hugle-v1.3.0';
const BASE = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/db.js', 'js/ia.js', 'js/util.js', 'js/negocio.js', 'js/vistas.js', 'js/vistas-ia.js', 'js/herramientas-ia.js',
  'js/config.js', 'js/plataforma.js', 'js/sectores.js', 'js/agentes.js', 'js/vistas-agentes.js', 'js/conexiones.js',
  'vendor/wllama/wllama.js', 'vendor/wllama/wllama.wasm',
  'img/logo.svg', 'img/hglmini.svg', 'img/icono-180.png', 'img/icono-512.png', 'img/icono-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('crm-hugle-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

function aislar(resp) {
  if (!resp || resp.status === 0 || resp.type === 'opaque') return resp;
  const h = new Headers(resp.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/modelo/')) return; // la IA incluida la instala y guarda js/ia.js en su propia caché
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // Red primero (para recibir actualizaciones), caché si no hay conexión.
      const r = await fetch(e.request);
      if (r.ok && r.type === 'basic') cache.put(e.request, r.clone());
      return aislar(r);
    } catch {
      const c = (await cache.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? await cache.match('index.html') : null);
      return c ? aislar(c) : Response.error();
    }
  })());
});
