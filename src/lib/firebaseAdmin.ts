import { getApps, initializeApp, getApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// --- Singleton instances ---
let _app: App | null = null;
let _db: ReturnType<typeof getFirestore> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;

// --- Configuration ---
// This is the correct Project ID for your application.
const TARGET_PROJECT_ID = "studio-7559545170-41328";

/**
 * Initializes and/or returns the singleton Firebase Admin App instance.
 * This function ensures the app is configured for the correct project.
 */
function getAdminApp(): App {
  // If we've already initialized, return the cached instance.
  if (_app) {
    return _app;
  }

  // If no apps are initialized, create a new one with the correct project ID.
  if (!getApps().length) {
    console.log(`[firebaseAdmin] Initializing new admin app for project: ${TARGET_PROJECT_ID}`);
    console.log(`[firebaseAdmin] Env GCLOUD_PROJECT: ${process.env.GCLOUD_PROJECT}`);
    console.log(`[firebaseAdmin] Env FIREBASE_CONFIG: ${process.env.FIREBASE_CONFIG}`);
    
    // By providing projectId, we override any incorrect environment settings.
    // This is crucial for fixing the 'aud' claim error.
    initializeApp({
      projectId: TARGET_PROJECT_ID,
    });
  }
  
  // Get the (now guaranteed to be initialized) default app.
  _app = getApp();

  // Log the final resolved project ID for verification.
  const resolvedProjectId = _app.options.projectId;
  console.log(`[firebaseAdmin] Using admin app with Project ID: ${resolvedProjectId}`);

  // Sanity check in case the environment is very weird.
  if (resolvedProjectId !== TARGET_PROJECT_ID) {
    console.error(`[firebaseAdmin] FATAL MISMATCH: Expected project '${TARGET_PROJECT_ID}' but resolved to '${resolvedProjectId}'.`);
  }

  return _app;
}

/**
 * Returns a singleton instance of the Admin Firestore service.
 */
export function adminDb() {
  if (_db) {
    return _db;
  }
  _db = getFirestore(getAdminApp());
  return _db;
}

/**
 * Returns a singleton instance of the Admin Auth service.
 */
export function adminAuth() {
  if (_auth) {
    return _auth;
  }
  _auth = getAuth(getAdminApp());
  return _auth;
}
