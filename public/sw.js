// Service worker for Samwise sub portal.
//
// Handles two things:
//   1. push  - displays a notification when the server fires a VAPID push.
//   2. notificationclick - opens / focuses the linked tab.
//
// The push payload from the server is intentionally empty (the server
// signs an empty body to avoid the per-subscription ECDH dance). On
// receipt we surface a generic "you have a new notification" banner;
// the user taps through to /app/notifications (or the in-app inbox) to
// see the details. Future: parse encrypted payload for the real title/body.

const NOTIF_DEFAULTS = {
  icon: "/samwise-icon.png",
  badge: "/favicon-64.png",
};

self.addEventListener("install", (event) => {
  // Activate immediately on first install so the user doesn't have to
  // close + reopen the tab to get push working.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch {
    data = { title: "New notification", body: "Tap to view." };
  }
  const title = data.title || "Samwise";
  const options = {
    body: data.body || "You have a new notification.",
    icon: NOTIF_DEFAULTS.icon,
    badge: NOTIF_DEFAULTS.badge,
    data: { link: data.link || "/" },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Focus an existing same-origin window if any; otherwise open one.
      const target = new URL(link, self.location.origin).href;
      for (const w of wins) {
        if (w.url === target) return w.focus();
      }
      for (const w of wins) {
        if (w.focus) return w.focus().then(() => w.navigate && w.navigate(target));
      }
      return self.clients.openWindow(target);
    }),
  );
});
