
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

  if (url.origin !== self.location.origin) return;

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
            // In a real implementation, this would iterate IDB/Cache, 
            // find pending messages, and POST them to the backend or trigger PeerJS reconnection.
            // For now, we simulate success to clear the browser trigger.
            console.log('[SW] Background Sync Triggered: Processing pending queue...')
        );
    }
});

// Handle incoming messages from the main app (IStokView) to trigger System Notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data } = event.data.payload;
    
    // Determine vibration pattern based on tag
    let vibrationPattern = [100, 50, 100];
    let actions = [];
    let requireInteraction = false;

    if (tag === 'istok_call') {
        vibrationPattern = [500, 1000, 500, 1000, 500]; // Longer, aggressive vibration for calls
        actions = [
            { action: 'answer', title: '📞 Jawab' },
            { action: 'decline', title: '❌ Tolak' }
        ];
        requireInteraction = true;
    } else if (tag === 'istok_req') {
        vibrationPattern = [200, 100, 200, 100];
        actions = [
            { action: 'open', title: 'Lihat' }
        ];
        requireInteraction = true;
    } else {
        actions = [
            { action: 'open', title: 'Buka' }
        ];
    }

    self.registration.showNotification(title, {
      body: body,
      icon: 'https://grainy-gradients.vercel.app/noise.svg', // Fallback icon
      badge: 'https://grainy-gradients.vercel.app/noise.svg',
      vibrate: vibrationPattern,
      tag: tag, // Tag ensures notifications of same type stack or replace
      renotify: true, // Alert user every time even if tag exists
      data: data, // Stores metadata like peerId
      actions: actions,
      requireInteraction: requireInteraction, // Keep visible until interacted
      silent: false
    });
  }
});

// Handle Notification Click (Smart Focusing & Actions)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(self.location.origin).href;
  const targetPeerId = event.notification.data ? event.notification.data.peerId : null;
  const action = event.action || 'open'; // 'answer', 'decline', 'open'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Try to find an existing window to focus
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(urlToOpen) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
             // Send message to the focused client to handle the UI logic
             if (focusedClient) {
                 focusedClient.postMessage({ 
                     type: 'NAVIGATE_CHAT', 
                     peerId: targetPeerId, 
                     action: action 
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
