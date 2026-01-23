"use client";

import type { FirebaseApp } from "firebase/app";
import type { Firestore } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

export async function registerFcmToken(params: {
  app: FirebaseApp;
  firestore: Firestore;
  uid: string;
}) {
  const { app, firestore, uid } = params;

  const supported = await isSupported().catch(() => false);
  if (!supported) return;

  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("NEXT_PUBLIC_FIREBASE_VAPID_KEY não definido no .env.local");
    return;
  }

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
}
