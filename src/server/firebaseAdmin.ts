import { getApps, initializeApp, getApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let _app: App | null = null;
let _db: ReturnType<typeof getFirestore> | null = null;

const TARGET_PROJECT_ID = "studio-7559545170-41328";

function getAdminApp(): App {
  if (_app) {
    return _app;
  }
  if (!getApps().length) {
    console.log(`[server/firebaseAdmin] Initializing new admin app for project: ${TARGET_PROJECT_ID}`);
    initializeApp({
      projectId: TARGET_PROJECT_ID,
    });
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
