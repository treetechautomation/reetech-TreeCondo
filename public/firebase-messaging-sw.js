/* eslint-disable */
/**
 * Firebase Messaging Service Worker
 * Gerado automaticamente por scripts/gen-firebase-messaging-sw.js
 */
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js");

firebase.initializeApp({
  "apiKey": "AIzaSyCQGGe8KBVXY8F4FNn7N-hc1PTibYsGXkc",
  "authDomain": "studio-7559545170-41328.firebaseapp.com",
  "projectId": "studio-7559545170-41328",
  "storageBucket": "studio-7559545170-41328.firebasestorage.app",
  "messagingSenderId": "675085408650",
  "appId": "1:675085408650:web:8e5c3079a375a47c3e5073"
});

const messaging = firebase.messaging();

// Background push: mostra notificação quando o app está fechado/minimizado
messaging.onBackgroundMessage((payload) => {
  try {
    const title =
      (payload?.notification?.title) ||
      (payload?.data?.title) ||
      "TreeCondo";
    const body =
      (payload?.notification?.body) ||
      (payload?.data?.body) ||
      "";

    const icon =
      (payload?.notification?.icon) ||
      "/icon-192.png";

    const click_action =
      (payload?.notification?.click_action) ||
      (payload?.data?.click_action) ||
      "/";

    self.registration.showNotification(title, {
      body,
      icon,
      data: { click_action, ...((payload && payload.data) ? payload.data : {}) },
    });
  } catch (e) {
    // silencioso
  }
});

// Clique na notificação abre/foca o app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event?.notification?.data?.click_action) || "/";
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of allClients) {
      if (c.url.includes(self.location.origin)) {
        try { await c.focus(); } catch {}
        try { await c.navigate(target); } catch {}
        return;
      }
    }
    await clients.openWindow(target);
  })());
});
