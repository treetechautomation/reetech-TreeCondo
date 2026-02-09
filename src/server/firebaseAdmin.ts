import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let _db: ReturnType<typeof getFirestore> | null = null;

export function adminDb() {
  if (_db) return _db;

  if (!getApps().length) {
    // Firebase App Hosting / GCP: usa Application Default Credentials (ADC)
    initializeApp();
  }

  _db = getFirestore();
  return _db;
}
