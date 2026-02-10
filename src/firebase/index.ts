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

/**
 * Resolve a config do Firebase de forma robusta:
 * 1) NEXT_PUBLIC_FIREBASE_* (dev/local)
 * 2) FIREBASE_WEBAPP_CONFIG (App Hosting injeta como JSON no build)
 */
function resolveFirebaseWebConfig(): {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
} {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // 1) Preferência: envs NEXT_PUBLIC_*
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

  // 2) Fallback: App Hosting (BUILD/RUNTIME) injeta FIREBASE_WEBAPP_CONFIG (JSON)
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (raw) {
    try {
      const cfg = JSON.parse(raw);
      if (cfg?.apiKey && cfg?.authDomain && cfg?.projectId) {
        return {
          apiKey: cfg.apiKey,
          authDomain: cfg.authDomain,
          projectId: cfg.projectId,
          storageBucket: cfg.storageBucket,
          messagingSenderId: cfg.messagingSenderId,
          appId: cfg.appId,
        };
      }
    } catch {
      // ignora e cai no erro abaixo
    }
  }

  // Se chegou aqui, a config está ausente/ruim
  throw new Error(
    "Configuração do Firebase inválida: defina NEXT_PUBLIC_FIREBASE_* (dev) ou garanta FIREBASE_WEBAPP_CONFIG (App Hosting)."
  );
}

// cache (singleton)
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _firestore: Firestore | null = null;

/**
 * initializeFirebase()
 * - Mantém singleton do app
 * - Retorna { app, auth, firestore }
 */
export function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore } {
  // reutiliza se já inicializou
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

/**
 * Hooks básicos compatíveis com o que as páginas estão importando
 */
export function useFirestore() {
  const [firestore, setFirestore] = useState<Firestore | null>(null);

  useEffect(() => {
    try {
      const { firestore } = initializeFirebase();
      setFirestore(firestore);
    } catch {
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
    } catch {
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
      } catch {
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

/**
 * useMemoFirebase: apenas um alias para useMemo (pra manter as páginas funcionando)
 */
export function useMemoFirebase<T>(factory: () => T, deps: any[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}

/**
 * useCollection: ouve uma Query do Firestore e devolve array
 */
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

/**
 * useDoc simples (pra páginas que quiserem usar daqui)
 */
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

/**
 * useUser: compat pra quem usa useSession.ts
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    let auth: Auth;
    try {
      auth = initializeFirebase().auth;
    } catch {
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
  // garante que usa a mesma resolução de config
  if (getApps().length) return getApp();
  return initializeApp(resolveFirebaseWebConfig());
}
