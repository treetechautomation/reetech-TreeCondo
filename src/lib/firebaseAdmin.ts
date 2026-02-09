import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let _db: ReturnType<typeof getFirestore> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;

function ensureAdminApp() {
  if (getApps().length) return;
  // Firebase App Hosting / GCP: usa Application Default Credentials (ADC)
  initializeApp();
}

export function adminDb() {
  if (_db) return _db;
  ensureAdminApp();
  _db = getFirestore();
  return _db;
}

export function adminAuth() {
  if (_auth) return _auth;
  ensureAdminApp();
  _auth = getAuth();
  return _auth;
}
