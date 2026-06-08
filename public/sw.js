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
      .then(() => self.skipWaiting())
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
      .then(() => self.clients.claim())
  )
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Network only — external / Firebase / API
  if (url.hostname !== self.location.hostname || url.pathname.startsWith('/api/')) {
    return
  }

  // Cache first — static assets
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|svg|jpg|ico|woff2|webp)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        
        return fetch(request).then((res) => {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          
          // 🔒 FIX: Clone ກ່ອນນຳໄປໃຊ້ ປ້ອງກັນ Response body already used
          const responseToCache = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          
          return res;
        }).catch(() => new Response('Network error for static asset', { status: 408 }));
      })
    )
    return
  }

  // Network first — HTML pages
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;

        // 🔒 FIX: Clone ທັນທີຫຼັງຈາກໄດ້ຮັບຄ່າຈາກ Network
        const responseToCache = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        
        return res;
      })
      .catch(() => caches.match(request))
  )
})

// SW Update — notify clients when new SW is ready
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

// =========================================================================
// 🔔 ພາກສ່ວນເພີ່ມໃໝ່: ດັກຮັບ PUSH NOTIFICATION (ເຕືອນ Check-in 8:00 & 8:14)
// =========================================================================

self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const options = {
        body: data.body || 'ກະລຸນາກົດ Check-in ເຂົ້າວຽກ',
        icon: data.icon || '/apple-icon.png',
        badge: data.badge || '/SSMI.svg',
        vibrate: [200, 100, 200],
        data: {
          url: data.url || '/dashboard/attendance'
        }
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'ແຈ້ງເຕືອນຈາກລະບົບ', options)
      );
    } catch (error) {
      console.error('Error handling push event:', error);
    }
  }
});

// ເມື່ອກົດປັອບອັບ ໃຫ້ລິ້ງໄປໜ້າ Check-in ຂອງແອັບ Next.js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetUrl = event.notification.data?.url || '/dashboard/attendance';
      
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});