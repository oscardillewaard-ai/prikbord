// Network-first (§4.1, regel 4): altijd de nieuwste versie ophalen als er
// internet is, en offline terugvallen op de cache. Zoals Tarapp.
// Bij een release: CACHE hier ophogen, samen met APP_VERSION in js/app.js
// (tests/sw.test.mjs bewaakt dat).
const CACHE = 'prikbord-v3'
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/beweging.js',
  'js/filter.js',
  'js/fotomaat.js',
  'js/geluid.js',
  'js/layout.js',
  'js/link.js',
  'js/merge.js',
  'js/model.js',
  'js/plek.js',
  'js/randen.js',
  'js/seed.js',
  'js/store.js',
  'js/sync.js',
  'js/validate.js',
  'js/vrij.js',
  'fonts/caveat-latin-700-normal.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'img/hout.svg',
  'img/korrel.svg',
  'img/kurk.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Alleen onze eigen oude versies weg: alle apps op dit domein delen één
      // cache-opslag (zie docs/prikbord-afwijkingen.md, A1).
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('prikbord-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  // Alleen de app zelf. Nooit de sync-worker, kaarttegels of andere sites:
  // die gaan gewoon langs de service worker heen.
  if (new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        // no-cache: altijd bij de server navragen of er iets nieuws is (GitHub
        // Pages laat de browser anders tot 10 minuten een oude kopie gebruiken).
        const res = await fetch(event.request, { cache: 'no-cache' })
        if (res.ok) cache.put(event.request, res.clone())
        return res
      } catch {
        const cached = await cache.match(event.request, { ignoreSearch: true })
        return cached || Response.error()
      }
    })(),
  )
})
