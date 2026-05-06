const CACHE_VERSION = 'ssmi-hrm-v2'
const CACHE_NAME = CACHE_VERSION

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/SSMI.svg',
  '/apple-icon.png',
]

// Install — cache assets, then skipWaiting INSIDE waitUntil
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            fetch(url).then((res) => { if (res.ok) cache.put(url, res) })
          )
        )
      )
      .then(() => self.skipWaiting()) // ← Inside chain, after cache is ready
  )
})

// Activate — clean old caches, claim clients INSIDE waitUntil
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim()) // ← Inside chain
  )
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Network only — external / Firebase
  if (url.hostname !== self.location.hostname || url.pathname.startsWith('/api/')) {
    return
  }

  // Cache first — static assets
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|svg|jpg|ico|woff2|webp)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
          return res
        })
      )
    )
    return
  }

  // Network first — HTML pages
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
        return res
      })
      .catch(() => caches.match(request))
  )
})

// SW Update — notify clients when new SW is ready
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
