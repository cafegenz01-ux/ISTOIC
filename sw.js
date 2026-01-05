
const CACHE_NAME = 'istoic-cache-v27';
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// --- TITANIUM NOTIFICATION HANDLER ---
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data } = event.data.payload;
    
    // VIBRATION PATTERNS
    // Call: Long, insistent vibration
    // Message: Short, double tap
    let vibrationPattern = [100, 50, 100];
    let requireInteraction = false;
    let actions = [];

    if (tag === 'istok_call') {
        vibrationPattern = [1000, 500, 1000, 500, 1000]; 
        requireInteraction = true;
        actions = [
            { action: 'answer', title: '📞 ANSWER' },
            { action: 'decline', title: '❌ DECLINE' }
        ];
    } else if (tag === 'istok_req') {
        vibrationPattern = [200, 100, 200, 100, 200];
        requireInteraction = true;
        actions = [
            { action: 'open', title: 'VIEW REQUEST' }
        ];
    } else {
        actions = [
            { action: 'open', title: 'READ' },
            { action: 'reply', title: 'REPLY' }
        ];
    }

    self.registration.showNotification(title, {
      body: body,
      icon: 'https://grainy-gradients.vercel.app/noise.svg', // Branding Icon
      badge: 'https://grainy-gradients.vercel.app/noise.svg',
      vibrate: vibrationPattern,
      tag: tag, // Ensures we don't spam stack, just update
      renotify: true, // Always buzz again for new events with same tag
      data: data,
      actions: actions,
      requireInteraction: requireInteraction,
      silent: false
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(self.location.origin).href;
  const targetPeerId = event.notification.data ? event.notification.data.peerId : null;

  // Handle Actions
  if (event.action === 'decline') {
      // Logic to send decline signal could go here via client messaging
      return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Focus existing window if available
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(urlToOpen) && 'focus' in client) {
          if (targetPeerId) {
             // Tell the frontend to navigate/open chat
             client.postMessage({ type: 'NAVIGATE_CHAT', peerId: targetPeerId, action: event.action });
          }
          return client.focus();
        }
      }
      // 2. Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen + (targetPeerId ? `/?connect=${targetPeerId}` : ''));
      }
    })
  );
});
