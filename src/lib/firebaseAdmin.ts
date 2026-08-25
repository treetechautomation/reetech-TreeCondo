import { getApps, initializeApp, getApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { credential } from "firebase-admin";

// --- Singleton instances ---
let _app: App | null = null;
let _db: ReturnType<typeof getFirestore> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;
let _msg: ReturnType<typeof getMessaging> | null = null;
let _storageBucket: ReturnType<ReturnType<typeof getStorage>["bucket"]> | null = null;

// --- Configuration ---
const PRODUCTION_PROJECT_ID = "studio-7559545170-41328";

// Fail-closed: só sai de produção se TREECONDO_ENV=staging E o project id
// de staging estiver explicitamente configurado. Nunca cai em produção
// silenciosamente por variável ausente.
export function resolveTargetProjectId(): string {
  const env = process.env.TREECONDO_ENV;
  if (env === "staging") {
    const stagingProjectId = process.env.TREECONDO_STAGING_PROJECT_ID;
    if (!stagingProjectId) {
      throw new Error(
        "[firebaseAdmin] TREECONDO_ENV=staging mas TREECONDO_STAGING_PROJECT_ID ausente. Abortando boot (fail-closed)."
      );
    }
    if (stagingProjectId === PRODUCTION_PROJECT_ID) {
      throw new Error(
        "[firebaseAdmin] TREECONDO_STAGING_PROJECT_ID aponta para o projeto de produção. Abortando boot."
      );
    }
    return stagingProjectId;
  }
  return PRODUCTION_PROJECT_ID;
}

const TARGET_PROJECT_ID = resolveTargetProjectId();

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
      // Only ADC (Application Default Credentials) — e.g. Firebase App Hosting or GCP managed environments
      console.log("[firebaseAdmin] No explicit credentials found. Using Application Default Credentials.");
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

/**
 * Bucket do Storage do projeto alvo (staging ou produção conforme
 * resolveTargetProjectId()). Reaproveita NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * — mesma env já usada pelo client SDK — para garantir que admin e client
 * sempre apontem para o mesmo bucket, sem uma segunda convenção de nome.
 */
export function adminStorage() {
  if (_storageBucket) return _storageBucket;
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const storage = getStorage(getAdminApp());
  _storageBucket = bucketName ? storage.bucket(bucketName) : storage.bucket();
  return _storageBucket;
}
