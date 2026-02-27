/* Gera public/firebase-messaging-sw.js a partir do .env.local (NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG) */
const fs = require("fs");

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = (m[2] ?? "").trim();
    if (
      (v.startsWith("'") && v.endsWith("'")) ||
      (v.startsWith('"') && v.endsWith('"'))
    ) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = {
  ...loadEnvFile(".env.local"),
  ...process.env,
};

const raw = env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG || env.FIREBASE_WEBAPP_CONFIG || "";
if (!raw) {
  console.error("❌ Nenhuma config encontrada: NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG ou FIREBASE_WEBAPP_CONFIG");
  process.exit(1);
}

let cfg;
try {
  cfg = JSON.parse(raw);
} catch (e) {
  console.error("❌ Não consegui fazer JSON.parse do NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG");
  console.error(raw);
  process.exit(1);
}

const firebaseJsVersion = "11.9.1"; // seu package.json mostra firebase ^11.9.1

const sw = `/* eslint-disable */
/**
 * Firebase Messaging Service Worker
 * Gerado automaticamente por scripts/gen-firebase-messaging-sw.js
 */
importScripts("https://www.gstatic.com/firebasejs/${firebaseJsVersion}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${firebaseJsVersion}/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(cfg, null, 2)});

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
`;

fs.writeFileSync("public/firebase-messaging-sw.js", sw, "utf8");
console.log("✅ Gerado: public/firebase-messaging-sw.js");
