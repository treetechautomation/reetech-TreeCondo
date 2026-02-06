import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let _db: ReturnType<typeof getFirestore> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;

/**
 * Garante que existe um Admin App inicializado.
 * - Dev/Studio: tenta carregar serviceAccountKey.json na raiz
 * - Produção: usa ADC (GOOGLE_APPLICATION_CREDENTIALS / ambiente do GCP)
 */
function ensureAdminApp() {
  if (getApps().length) return;

  try {
     
    const serviceAccount = require("../../serviceAccountKey.json");
    initializeApp({ credential: cert(serviceAccount) });
  } catch (e) {
    initializeApp(); // fallback (ADC)
  }
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
