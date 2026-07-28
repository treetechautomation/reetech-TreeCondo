import { getApps, initializeApp, getApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { credential } from "firebase-admin";
import fs from "fs";
import path from "path";

let _app: App | null = null;
let _db: ReturnType<typeof getFirestore> | null = null;

const TARGET_PROJECT_ID = "studio-7559545170-41328";

function getAdminApp(): App {
  if (_app) {
    return _app;
  }
  if (!getApps().length) {
    console.log(`[server/firebaseAdmin] Initializing new admin app for project: ${TARGET_PROJECT_ID}`);
    
    const config: any = {
      projectId: TARGET_PROJECT_ID,
    };

    // 1. Check if individual environment variables exist
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      console.log("[server/firebaseAdmin] Using credentials from environment variables");
      config.credential = credential.cert({
        projectId: TARGET_PROJECT_ID,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      });
    } else {
      // 2. Check if a local serviceAccountKey.json file exists (gitignored)
      const localKeyPath = path.join(process.cwd(), "serviceAccountKey.json");
      if (fs.existsSync(localKeyPath)) {
        console.log("[server/firebaseAdmin] Using credentials from local serviceAccountKey.json file");
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
          config.credential = credential.cert(serviceAccount);
        } catch (err) {
          console.error("[server/firebaseAdmin] Error loading local serviceAccountKey.json:", err);
        }
      } else {
        console.warn("[server/firebaseAdmin] No credentials found. Falling back to ADC.");
      }
    }

    initializeApp(config);
  }
  _app = getApp();
  const resolvedProjectId = _app.options.projectId;
  console.log(`[server/firebaseAdmin] Using admin app with Project ID: ${resolvedProjectId}`);
  if (resolvedProjectId !== TARGET_PROJECT_ID) {
    console.error(`[server/firebaseAdmin] FATAL MISMATCH: Expected '${TARGET_PROJECT_ID}' but resolved to '${resolvedProjectId}'.`);
  }
  return _app;
}

export function adminDb() {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  return _db;
}
