"use client";

import { useEffect, useMemo, useState } from "react";
import { FirebaseApp, initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type Auth, type User } from "firebase/auth";
import {
  getFirestore,
  type Firestore,
  type Query,
  onSnapshot,
  type DocumentData,
  getDoc,
  doc,
} from "firebase/firestore";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

function parseCfg(raw: any): FirebaseWebConfig | null {
  if (!raw) return null;
  try {
    const cfg = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (cfg?.apiKey && cfg?.authDomain && cfg?.projectId) return cfg as FirebaseWebConfig;
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a config do Firebase de forma robusta:
 * 1) Chaves individuais (dev/local override)
 * 2) JSON string da env NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG (App Hosting client/server)
 * 3) JSON string da env FIREBASE_WEBAPP_CONFIG (App Hosting server-side fallback)
 */
function resolveFirebaseWebConfig(): FirebaseWebConfig {
  // 1) Individual keys for local .env.local override
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (apiKey && authDomain && projectId) {
    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }

  // 2) JSON config string (primary method for App Hosting)
  // This var is set by apphosting.yaml and is available in all environments.
  const publicCfgJson = process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG;
  if (publicCfgJson) {
    const parsed = parseCfg(publicCfgJson);
    if (parsed) return parsed;
  }
  
  // 3) Fallback for server-side only var (less common, but safe to check)
  // This will only work on the server.
  if (typeof window === "undefined") {
      const serverCfgJson = process.env.FIREBASE_WEBAPP_CONFIG;
      if (serverCfgJson) {
          const parsed = parseCfg(serverCfgJson);
          if (parsed) return parsed;
      }
  }

  // If we're here, no config was found.
  throw new Error(
    "Configuração do Firebase não encontrada. Verifique as variáveis de ambiente."
  );
}


// ---------- singleton ----------
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _firestore: Firestore | null = null;

export function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore } {
  if (_app && _auth && _firestore) return { app: _app, auth: _auth, firestore: _firestore };

  const firebaseConfig = resolveFirebaseWebConfig();

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  _app = app;
  _auth = auth;
  _firestore = firestore;

  return { app, auth, firestore };
}

export function useFirestore() {
  const [firestore, setFirestore] = useState<Firestore | null>(null);

  useEffect(() => {
    try {
      const { firestore } = initializeFirebase();
      setFirestore(firestore);
    } catch (e) {
      console.error("[firebase] init error:", e);
      setFirestore(null);
    }
  }, []);

  return firestore as any;
}

export function useClaims() {
  const [claims, setClaims] = useState<Record<string, any> | null>(null);
  const [isClaimsLoading, setIsClaimsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    let auth: Auth;
    try {
      auth = initializeFirebase().auth;
    } catch (e) {
      console.error("[claims] init error:", e);
      setClaims(null);
      setIsClaimsLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!mounted) return;

      if (!u) {
        setClaims(null);
        setIsClaimsLoading(false);
        return;
      }

      try {
        setIsClaimsLoading(true);
        const token = await u.getIdTokenResult(true);
        if (!mounted) return;
        setClaims(token.claims || {});
      } catch (e) {
        console.error("[claims] token error:", e);
        if (!mounted) return;
        setClaims(null);
      } finally {
        if (mounted) setIsClaimsLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { claims, isClaimsLoading };
}

export function useMemoFirebase<T>(factory: () => T, deps: any[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}

export function useCollection<T = any>(q: Query<DocumentData> | null) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!q);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!q) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as T[];
        setData(items);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [q]);

  return { data, isLoading, error };
}

export function useDoc<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!path);

  useEffect(() => {
    let mounted = true;

    if (!path) {
      setData(null);
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        setIsLoading(true);
        const firestore = initializeFirebase().firestore;
        const ref = doc(firestore, path);
        const snap = await getDoc(ref);
        if (!mounted) return;
        setData((snap.exists() ? (snap.data() as any) : null) as T | null);
      } catch (e) {
        console.error("[useDoc] error:", e);
        if (mounted) setData(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [path]);

  return { data, isLoading };
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    let auth: Auth;
    try {
      auth = initializeFirebase().auth;
    } catch (e) {
      console.error("[user] init error:", e);
      setUser(null);
      setIsUserLoading(false);
      return;
    }

    setIsUserLoading(true);

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setIsUserLoading(false);
    });

    return () => unsub();
  }, []);

  return { user, isUserLoading };
}

// re-exports de hooks
export { useAuth } from "./hooks/useAuth";

export function getFirebaseApp() {
  return initializeFirebase().app;
}
