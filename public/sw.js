// Property Fy Service Worker — PWA Push Notifications & Deep-Link Routing
// Handles push events as native system notifications and routes clicks to lead details.

const CACHE_NAME = 'propertyfy-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Handle push notifications — display as native system notification
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Property Fy', body: event.data ? event.data.text() : 'New notification' };
  }

  const title = data.title || 'Property Fy';
  const options = {
    body: data.body || 'You have a new update',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { leadId: data.leadId || null, url: data.url || '/' },
    vibrate: [200, 100, 200],
    tag: data.leadId ? `lead-${data.leadId}` : 'general',
    requireInteraction: !!data.leadId,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click — deep-link to lead details
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const leadId = event.notification.data?.leadId;
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Find an existing app window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          // Focus existing window and dispatch deep-link event
          client.focus();
          if (leadId) {
            client.postMessage({ type: 'open-lead-detail', leadId });
          }
          return;
        }
      }
      // No existing window — open new one with URL hash for deep-linking
      const url = leadId ? `${targetUrl}#lead=${leadId}` : targetUrl;
      return self.clients.openWindow(url);
    })
  );
});

// Handle messages from the app (e.g., push subscription)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
