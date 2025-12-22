"use client";

import React, { ReactNode, useCallback, useEffect, useState } from "react";
import type { FirebaseApp } from "firebase/app";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

/**
 * Config do Firebase
 * Usa as mesmas envs já utilizadas no restante do projeto.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

type FirebaseAuth = ReturnType<typeof getAuth>;

export interface FirebaseContextValue {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: FirebaseAuth;
  areServicesAvailable: boolean;
  error: Error | null;
}

/**
 * Inicializa (ou reaproveita) a instância do Firebase na camada client.
 */
function ensureFirebase(): Omit<FirebaseContextValue, "areServicesAvailable" | "error"> {
  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    throw new Error("Configuração do Firebase inválida. Verifique variáveis de ambiente NEXT_PUBLIC_FIREBASE_*.");
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  return { firebaseApp: app, auth, firestore };
}

/**
 * Este "Provider" agora é bem simples: apenas garante que o Firebase seja
 * inicializado no client e renderiza os filhos normalmente.
 *
 * Como os hooks abaixo usam `ensureFirebase()` diretamente, eles funcionam
 * mesmo se, por algum motivo, você esquecer de usar o Provider.
 */
export interface FirebaseProviderProps {
  children: ReactNode;
}

export function FirebaseProvider({ children }: FirebaseProviderProps) {
  // Só garante que o app seja inicializado uma vez.
  useEffect(() => {
    try {
      ensureFirebase();
    } catch (err) {
      console.error("[FirebaseProvider] Erro ao inicializar Firebase:", err);
    }
  }, []);

  return <>{children}</>;
}

/**
 * Hooks principais
 */

export function useFirebase(): FirebaseContextValue {
  try {
    const core = ensureFirebase();
    return {
      ...core,
      areServicesAvailable: true,
      error: null,
    };
  } catch (err: any) {
    console.error("[useFirebase] Erro ao obter instâncias do Firebase:", err);
    // Em caso de erro, ainda retornamos um objeto para não quebrar o app inteiro.
    // Os campos firebaseApp/auth/firestore ficam como `undefined` (via `as any`).
    return {
      firebaseApp: undefined as any,
      firestore: undefined as any,
      auth: undefined as any,
      areServicesAvailable: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Compatibilidade com código antigo que usava `useFirebaseCore`.
 * Agora apenas delega para `useFirebase`.
 */
export function useFirebaseCore(): FirebaseContextValue {
  return useFirebase();
}

/**
 * Usuário autenticado + loading.
 */
export function useUser() {
  const { auth } = useFirebase();
  const [user, setUser] = useState<User | null>(() => auth?.currentUser ?? null);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(!auth?.currentUser);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setIsUserLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsUserLoading(false);
    });

    return () => unsub();
  }, [auth]);

  return { user, isUserLoading };
}

/**
 * Custom claims do usuário (isGlobalAdmin, roles, etc).
 */
export function useClaims() {
  const { auth } = useFirebase();
  const [claims, setClaims] = useState<Record<string, any> | null>(null);
  const [isClaimsLoading, setIsClaimsLoading] = useState<boolean>(true);

  const refreshClaims = useCallback(async () => {
    if (!auth) {
      setClaims(null);
      setIsClaimsLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setClaims(null);
      setIsClaimsLoading(false);
      return;
    }

    setIsClaimsLoading(true);
    try {
      const tokenResult = await currentUser.getIdTokenResult(true);
      setClaims(tokenResult.claims ?? {});
    } catch (err) {
      console.error("[useClaims] Erro ao buscar custom claims:", err);
    } finally {
      setIsClaimsLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    refreshClaims();
  }, [refreshClaims]);

  return { claims, isClaimsLoading, refreshClaims };
}

/**
 * Atalhos para Firestore e Auth.
 */
export function useFirestore() {
  const { firestore } = useFirebase();
  if (!firestore) {
    throw new Error("Firestore não está disponível. Verifique configuração do Firebase.");
  }
  return firestore;
}

export function useAuth() {
  const { auth } = useFirebase();
  if (!auth) {
    throw new Error("Auth não está disponível. Verifique configuração do Firebase.");
  }
  return auth;
}

/**
 * Stubs simples de tratamento de erro para manter compatibilidade
 * com possíveis imports existentes. Eles não fazem nada demais,
 * apenas expõem um estado de erro opcional.
 */
export interface FirebaseErrorState {
  lastError: Error | null;
  setLastError: (err: Error | null) => void;
}

export function useFirebaseErrorListener(): FirebaseErrorState {
  const [lastError, setLastError] = useState<Error | null>(null);
  return { lastError, setLastError };
}

export function useFirebaseErrorState() {
  return useFirebaseErrorListener();
}

export function useFirebaseErrorHandler() {
  const { setLastError } = useFirebaseErrorListener();
  return useCallback(
    (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[Firebase] erro:", error);
      setLastError(error);
    },
    [setLastError],
  );
}
