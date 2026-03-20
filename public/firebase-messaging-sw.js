importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
});

const messaging = firebase.messaging();

// 🔥 ESSENCIAL PARA APP FECHADO
messaging.onBackgroundMessage(function (payload) {
  console.log("[FCM] background message", payload);

  const notificationTitle = payload.notification?.title || "TreeCondo";
  const notificationOptions = {
    body: payload.notification?.body || "Nova notificação",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// clique na notificação
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification?.data?.click_action || "/encomendas";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
