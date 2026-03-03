import { getApps, initializeApp, getApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

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

    // Override any incorrect environment settings (fix 'aud' mismatches)
    initializeApp({
      projectId: TARGET_PROJECT_ID,
    });
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
