import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let _db: ReturnType<typeof getFirestore> | null = null;

export function adminDb() {
  if (_db) return _db;

  if (!getApps().length) {
    try {
      // DEV/Studio: usa o arquivo serviceAccountKey.json na raiz do projeto
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const serviceAccount = require("../../serviceAccountKey.json");
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      // Produção: usa ADC (GOOGLE_APPLICATION_CREDENTIALS, etc)
      initializeApp();
    }
  }

  _db = getFirestore();
  return _db;
}
