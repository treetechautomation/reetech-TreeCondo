// src/firebase/push.ts

import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirebaseApp } from "./index";

const VAPID_KEY = "BNwQtsHZb-GUeCxnmYw4EIZ2imB9vHojnNLnT9uR2xZXWiOdW_pMdZpGzernwyYfL86dXhTwHevaldAeir8Oogo";

export async function solicitarPermissaoNotificacao(userId: string) {
  try {
    const app = getFirebaseApp();
    const messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Permissão de notificação negada.");
      return;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (!token) {
      console.log("Token não gerado.");
      return;
    }

    console.log("Token FCM:", token);

    // salvar token no backend
    await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userId }),
    });

  } catch (error) {
    console.error("Erro ao solicitar notificação:", error);
  }
}

export function escutarNotificacoesForeground() {
  const app = getFirebaseApp();
  const messaging = getMessaging(app);

  onMessage(messaging, (payload) => {
    console.log("Notificação recebida em foreground:", payload);

    new Notification(payload.notification?.title || "Nova notificação", {
      body: payload.notification?.body,
      icon: "/icon-192.png",
    });
  });
}
