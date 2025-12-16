"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useUser, initializeFirebase } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN_CONDOMINIO"
  | "SINDICO"
  | "SUB_SINDICO"
  | "MORADOR"
  | "FUNCIONARIO";

export type VinculoScope =
  | { type: "GLOBAL" }
  | { type: "CONDOMINIO"; condominioId: string }
  | { type: "BLOCO"; condominioId: string; blocoId: string }
  | { type: "UNIDADE"; condominioId: string; blocoId: string; unidadeId: string };

export type Vinculo = {
  condominioId: string;
  role: Role;
  scope?: VinculoScope;
  ativo?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Session = {
  uid: string;
  email: string | null;
  displayName: string | null;
  vinculos: Vinculo[];
  activeCondominioId: string | null;
  isSuperAdmin: boolean;
};

const mem = {
  sessionByUid: new Map<string, { at: number; session: Session }>(),
  vinculosByUid: new Map<string, { at: number; vinculos: Vinculo[] }>(),
};

const LS_KEY = (uid: string) => `tc_session_${uid}`;
const LS_ACTIVE_COND = (uid: string) => `tc_active_condominio_${uid}`;

const TTL_MS = 20 * 60 * 1000;

function safeJsonParse<T>(s: string | null): T | null {
  try {
    if (!s) return null;
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function pickActiveCondominio(uid: string, vinculos: Vinculo[]): string | null {
  const saved =
    typeof window !== "undefined" ? localStorage.getItem(LS_ACTIVE_COND(uid)) : null;
  if (saved && vinculos.some((v) => v.condominioId === saved)) return saved;

  const first =
    vinculos.find((v) => v.ativo !== false)?.condominioId ?? vinculos[0]?.condominioId ?? null;
  return first ?? null;
}

async function fetchVinculos(uid: string, force = false): Promise<Vinculo[]> {
  const now = Date.now();

  if (!force) {
    const m = mem.vinculosByUid.get(uid);
    if (m && now - m.at < TTL_MS) return m.vinculos;

    const fromLs = safeJsonParse<{ at: number; vinculos: Vinculo[] }>(
      typeof window !== "undefined" ? localStorage.getItem(LS_KEY(uid)) : null
    );
    if (fromLs && now - fromLs.at < TTL_MS && Array.isArray(fromLs.vinculos)) {
      mem.vinculosByUid.set(uid, { at: fromLs.at, vinculos: fromLs.vinculos });
      return fromLs.vinculos;
    }
  }


  const { firestore } = initializeFirebase();
  const ref = collection(firestore, `userCondominios/${uid}/vinculos`);
  const snap = await getDocs(ref);

  const vinculos: Vinculo[] = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      condominioId: data.condominioId ?? d.id,
      role: data.role,
      scope: data.scope,
      ativo: data.ativo ?? true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  mem.vinculosByUid.set(uid, { at: now, vinculos });
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_KEY(uid), JSON.stringify({ at: now, vinculos }));
  }
  return vinculos;
}

export function useSession() {
  const { user, isUserLoading } = useUser();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const uid = user?.uid ?? null;
  const inflightRef = useRef<Promise<void> | null>(null);
  const inflightRefreshRef = useRef<Promise<void> | null>(null);


  const isPublicReady = useMemo(() => !isUserLoading, [isUserLoading]);

  const loadSession = useCallback(async (uid: string, force = false) => {
    try {
      const vinculos = await fetchVinculos(uid, force);
      const activeCondominioId = pickActiveCondominio(uid, vinculos);
      const isSuperAdmin = vinculos.some((v) => v.role === "SUPER_ADMIN");

      const s: Session = {
        uid,
        email: user?.email ?? null,
        displayName: user?.displayName ?? null,
        vinculos,
        activeCondominioId,
        isSuperAdmin,
      };

      mem.sessionByUid.set(uid, { at: Date.now(), session: s });

      if (typeof window !== "undefined") {
        localStorage.setItem(LS_KEY(uid), JSON.stringify({ at: Date.now(), session: s }));
        if (activeCondominioId) localStorage.setItem(LS_ACTIVE_COND(uid), activeCondominioId);
      }

      setSession(s);
    } catch (e: any) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setSession(null);
    }
  }, [user]);


  useEffect(() => {
    if (!isPublicReady) return;

    if (!uid) {
      setSession(null);
      setLoading(false);
      setError(null);
      return;
    }

    const now = Date.now();

    if (!inflightRef.current) {
        const ms = mem.sessionByUid.get(uid);
        if (ms && now - ms.at < TTL_MS) {
            setSession(ms.session);
            setLoading(false);
            setError(null);
            return;
        }

        const fromLs = safeJsonParse<{ at: number; session: Session }>(
            typeof window !== "undefined" ? localStorage.getItem(LS_KEY(uid)) : null
        );
        if (fromLs && fromLs.session?.uid === uid && now - fromLs.at < TTL_MS) {
            mem.sessionByUid.set(uid, { at: fromLs.at, session: fromLs.session });
            setSession(fromLs.session);
            setLoading(false);
            setError(null);
            return;
        }
    }
    

    if (inflightRef.current) return;

    setLoading(true);
    setError(null);

    inflightRef.current = (async () => {
        await loadSession(uid, false);
        setLoading(false);
        inflightRef.current = null;
    })();
  }, [uid, isPublicReady, loadSession]);

   const refreshSession = useCallback(async () => {
    if (!uid) return;
    if (inflightRefreshRef.current) return;

    setLoading(true);
    setError(null);
    
    inflightRefreshRef.current = (async () => {
        await loadSession(uid, true);
        setLoading(false);
        inflightRefreshRef.current = null;
    })();

    await inflightRefreshRef.current;
  }, [uid, loadSession]);

  return {
    session,
    isSessionLoading: isUserLoading || loading,
    error,
    refreshSession,
    setActiveCondominioId: (condominioId: string) => {
      if (!uid) return;

      if (typeof window !== "undefined") {
        localStorage.setItem(LS_ACTIVE_COND(uid), condominioId);
      }

      setSession((prev) => (prev ? { ...prev, activeCondominioId: condominioId } : prev));

      const prevMem = mem.sessionByUid.get(uid);
      if (prevMem?.session) {
        mem.sessionByUid.set(uid, {
          at: prevMem.at,
          session: { ...prevMem.session, activeCondominioId: condominioId },
        });
      }
    },
  };
}
