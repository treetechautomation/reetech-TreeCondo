"use client";

import type { FirebaseApp } from "firebase/app";
import type { Firestore } from "firebase/firestore";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Registra token FCM (Web Push) de forma 100% opcional (não quebra o app).
 */
export async function registerFcmToken(params: {
  app: FirebaseApp;
  firestore: Firestore;
  uid: string;
}) {
  try {
    const { app, firestore, uid } = params;

    if (!isBrowser()) return;
    if (!("Notification" in window)) return;

    const supported = await isSupported().catch(() => false);
    if (!supported) return;

    // se já negou, não insiste
    if (Notification.permission === "denied") return;

    // ✅ tipagem correta
    let permission: NotificationPermission = Notification.permission;

    if (permission !== "granted") {
      try {
        permission = await Notification.requestPermission();
      } catch {
        return;
      }
    }

    if (permission !== "granted") return;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey }).catch(() => null);
    if (!token) return;

    await setDoc(
      doc(firestore, "users", uid, "fcmTokens", token),
      {
        token,
        platform: "web",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    return;
  }
}
