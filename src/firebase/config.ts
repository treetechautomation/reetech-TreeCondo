import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";

let firebaseApp: FirebaseApp | null = null;

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

/**
 * Inicializa (ou reutiliza) a instância do Firebase App.
 */
export function initializeFirebase(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }

  return firebaseApp;
}
