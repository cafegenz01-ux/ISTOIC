
const CACHE_NAME = 'istoic-cache-v30';
const OFFLINE_URL = '/index.html';
const CORE_ASSETS = [
  OFFLINE_URL,
  '/manifest.json',
  '/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Only manage same-origin requests
  if (url.origin !== self.location.origin) return;

  // Navigation requests: fall back to offline shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, copy)).catch(() => {});
        return response;
      }).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || Response.error();
      })
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// BACKGROUND SYNC EVENT
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-pending-messages') {
        event.waitUntil(
            console.log('[SW] Background Sync Triggered: Processing pending queue...')
        );
    }
});

// --- HIGH PRIORITY ALERT SYSTEM ---
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data, type } = event.data.payload;
    
    // 1. AGGRESSIVE VIBRATION PATTERN (Simulate Ringing)
    // Format: [vibrate, pause, vibrate, pause...]
    let vibrationPattern = [200, 100, 200]; // Default Message

    if (type === 'CALL' || tag === 'istok_call') {
        // Heartbeat-like aggressive ringing vibration
        // 1s vibrate, 0.5s pause, repeat lengthy
        vibrationPattern = [
            1000, 500, 1000, 500, 1000, 500, 
            1000, 500, 1000, 500, 2000
        ];
    } else if (type === 'REQUEST') {
        vibrationPattern = [500, 200, 500, 200];
    }

    // 2. ACTIONS
    let actions = [
        { action: 'open', title: '👁️ Buka Aplikasi' }
    ];

    if (type === 'CALL') {
        actions = [
            { action: 'answer', title: '📞 TERIMA PANGGILAN' },
            { action: 'decline', title: '❌ TOLAK' }
        ];
    }

    // 3. SHOW NOTIFICATION
    self.registration.showNotification(title, {
      body: body,
      icon: 'https://grainy-gradients.vercel.app/noise.svg', // Branding Icon
      badge: 'https://grainy-gradients.vercel.app/noise.svg',
      vibrate: vibrationPattern,
      tag: tag, // Critical for avoiding duplicate stacks, updates existing one
      renotify: true, // TRUE = Play sound/vibrate again even if replacing old notif with same tag
      data: { ...data, type }, 
      actions: actions,
      requireInteraction: true, // TRUE = Keeps notification on screen until user interacts (Wake-like behavior)
      silent: false,
      timestamp: Date.now()
    });
  }
});

// --- SMART CLICK HANDLER ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(self.location.origin).href;
  const notificationData = event.notification.data || {};
  const targetPeerId = notificationData.peerId;
  const action = event.action || 'open'; // 'answer', 'decline', 'open'

  // Handle 'decline' action without opening window if possible, 
  // or open window to process decline logic then close (PWA limitation)
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Try to find an existing window to focus
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(urlToOpen) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
             // Send message to the focused client to handle the UI logic immediately
             if (focusedClient) {
                 focusedClient.postMessage({ 
                     type: 'NAVIGATE_CHAT', 
                     peerId: targetPeerId, 
                     action: action,
                     payload: notificationData
                 });
             }
          });
        }
      }
      
      // 2. If no window open, open a new one
      if (clients.openWindow) {
        // Append action to URL hash so app can handle it on boot
        const bootUrl = urlToOpen + (targetPeerId ? `?connect=${targetPeerId}&action=${action}` : '');
        return clients.openWindow(bootUrl);
      }
    })
  );
});
