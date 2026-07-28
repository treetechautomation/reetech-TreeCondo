import { getApps, initializeApp, getApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { credential } from "firebase-admin";
import fs from "fs";
import path from "path";

// --- Singleton instances ---
let _app: App | null = null;
let _db: ReturnType<typeof getFirestore> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;
let _msg: ReturnType<typeof getMessaging> | null = null;

// --- Configuration ---
// This is the correct Project ID for your application.
const TARGET_PROJECT_ID = "studio-7559545170-41328";

/**
 * Initializes and/or returns the singleton Firebase Admin App instance.
 * This function ensures the app is configured for the correct project.
 */
function getAdminApp(): App {
  if (_app) return _app;

  if (!getApps().length) {
    console.log(
      `[firebaseAdmin] Initializing new admin app for project: ${TARGET_PROJECT_ID}`
    );
    console.log(`[firebaseAdmin] Env GCLOUD_PROJECT: ${process.env.GCLOUD_PROJECT}`);
    console.log(`[firebaseAdmin] Env FIREBASE_CONFIG: ${process.env.FIREBASE_CONFIG}`);

    const config: any = {
      projectId: TARGET_PROJECT_ID,
    };

    // 1. Check if individual environment variables exist
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      console.log("[firebaseAdmin] Using credentials from environment variables");
      config.credential = credential.cert({
        projectId: TARGET_PROJECT_ID,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      });
    } else {
      // 2. Check if a local serviceAccountKey.json file exists (gitignored)
      const localKeyPath = path.join(process.cwd(), "serviceAccountKey.json");
      if (fs.existsSync(localKeyPath)) {
        console.log("[firebaseAdmin] Using credentials from local serviceAccountKey.json file");
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
          config.credential = credential.cert(serviceAccount);
        } catch (err) {
          console.error("[firebaseAdmin] Error loading local serviceAccountKey.json:", err);
        }
      } else {
        console.warn("[firebaseAdmin] No credentials found. Falling back to ADC.");
      }
    }

    initializeApp(config);
  }

  _app = getApp();

  const resolvedProjectId = _app.options.projectId;
  console.log(`[firebaseAdmin] Using admin app with Project ID: ${resolvedProjectId}`);

  if (resolvedProjectId !== TARGET_PROJECT_ID) {
    console.error(
      `[firebaseAdmin] FATAL MISMATCH: Expected project '${TARGET_PROJECT_ID}' but resolved to '${resolvedProjectId}'.`
    );
  }

  return _app;
}

export function adminDb() {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  return _db;
}

export function adminAuth() {
  if (_auth) return _auth;
  _auth = getAuth(getAdminApp());
  return _auth;
}

export function adminMessaging() {
  if (_msg) return _msg;
  _msg = getMessaging(getAdminApp());
  return _msg;
}
