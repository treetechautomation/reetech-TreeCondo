 
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  "apiKey": "AIzaSyCQGGe8KBVXY8F4FNn7N-hc1PTibYsGXkc",
  "authDomain": "studio-7559545170-41328.firebaseapp.com",
  "projectId": "studio-7559545170-41328",
  "storageBucket": "studio-7559545170-41328.firebasestorage.app",
  "messagingSenderId": "675085408650",
  "appId": "1:675085408650:web:8e5c3079a375a47c3e5073"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "TreeCondo";
  const options = {
    body: payload?.notification?.body || "Você recebeu uma nova mensagem.",
    data: payload?.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/anuncios";
  event.waitUntil(clients.openWindow(url));
});
