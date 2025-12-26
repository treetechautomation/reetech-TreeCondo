import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let _db: ReturnType<typeof getFirestore> | null = null;

export function adminDb() {
  if (_db) return _db;

  // Tenta usar serviceAccountKey.json do projeto (dev/studio).
  // Em produção, prefira variáveis de ambiente / ADC.
  if (!getApps().length) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const serviceAccount = require("../../serviceAccountKey.json");
      initializeApp({
        credential: cert(serviceAccount),
      });
    } catch {
      initializeApp(); // fallback (ADC)
    }
  }

  _db = getFirestore();
  return _db;
}
