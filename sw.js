
const CACHE_NAME = 'istoic-cache-v26';
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle incoming messages from the main app (IStokView) to trigger System Notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data } = event.data.payload;
    
    // Determine vibration pattern based on tag
    let vibrationPattern = [100, 50, 100];
    if (tag === 'istok_call') {
        vibrationPattern = [500, 500, 500, 500, 500]; // Longer vibration for calls
    }

    // Determine actions based on tag
    let actions = [];
    if (tag === 'istok_call') {
        actions = [
            { action: 'answer', title: 'Accept' },
            { action: 'decline', title: 'Decline' }
        ];
    } else {
        actions = [
            { action: 'open', title: 'View' }
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
      requireInteraction: tag === 'istok_call' // Keep calls visible until interacted
    });
  }
});

// Handle Notification Click (Smart Focusing)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(self.location.origin).href;
  const targetPeerId = event.notification.data ? event.notification.data.peerId : null;

  // Handle specific actions (buttons on notification)
  if (event.action === 'answer' || event.action === 'open') {
      // Proceed to focus window
  } else if (event.action === 'decline') {
      // Just close (handled by notification.close() above), optionally send message to client to terminate
      return; 
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Try to find an existing window
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(urlToOpen) && 'focus' in client) {
          if (targetPeerId) {
            // Signal the client to navigate or accept call
            client.postMessage({ type: 'NAVIGATE_CHAT', peerId: targetPeerId, action: event.action });
          }
          return client.focus();
        }
      }
      // 2. If no window open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen + (targetPeerId ? `/?connect=${targetPeerId}` : ''));
      }
    })
  );
});
