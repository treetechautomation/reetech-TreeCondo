"use client";

import type { FirebaseApp } from "firebase/app";
import { initializeApp, getApp, getApps } from "firebase/app";
import type { Firestore } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { getAuth } from "firebase/auth";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

let cachedServices: FirebaseServices | null = null;

export function initializeFirebase(): FirebaseServices {
  if (cachedServices) return cachedServices;

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_FIREBASE_* não estão configuradas. Confira o .env."
    );
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  cachedServices = { app, auth, firestore };
  return cachedServices;
}

export const getFirebaseApp = (): FirebaseApp => initializeFirebase().app;
export const getFirebaseAuth = (): Auth => initializeFirebase().auth;
export const getFirebaseFirestore = (): Firestore =>
  initializeFirebase().firestore;

// Re-exporta Provider + hooks (useFirebase, useUser, useClaims, useAuth, useFirestore, etc.)
export * from "./provider";
