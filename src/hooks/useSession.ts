"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser, initializeFirebase } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { IdTokenResult } from "firebase/auth";

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN_CONDOMINIO"
  | "SINDICO"
  | "SUB_SINDICO"
  | "MORADOR"
  | "FUNCIONARIO"
  | "PORTEIRO";

export type VinculoScope =
  | { type: "GLOBAL" }
  | { type: "CONDOMINIO"; condominioId: string }
  | { type: "BLOCO"; condominioId: string; blocoId: string }
  | { type: "UNIDADE"; condominioId: string; blocoId: string; unidadeId: string };

export type Vinculo = {
  condominioId: string;
  condominioNome?: string;
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
  activeVinculo: Vinculo | null;
  claims?: Record<string, any>;
};

const mem = {
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

async function fetchClaims(force = true): Promise<IdTokenResult | null> {
  const { auth } = initializeFirebase();
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdTokenResult(force);
  } catch {
    return null;
  }
}

function pickActiveCondominio(
  uid: string,
  vinculos: Vinculo[],
  isSuperAdmin: boolean
): string | null {
  const saved =
    typeof window !== "undefined" ? localStorage.getItem(LS_ACTIVE_COND(uid)) : null;

  // ✅ SUPER_ADMIN pode manter qualquer condomínio salvo (não depende de vínculos)
  if (isSuperAdmin) {
    return (
      saved ??
      vinculos.find((v) => v.ativo !== false)?.condominioId ??
      vinculos[0]?.condominioId ??
      null
    );
  }

  // 🔒 Usuário comum: só aceita se estiver nos vínculos
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
      condominioNome: data.condominioNome,
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

function buildSession(params: {
  uid: string;
  user: any;
  vinculos: Vinculo[];
  activeCondominioId: string | null;
  claims?: Record<string, any>;
}) {
  const { uid, user, vinculos, activeCondominioId, claims } = params;

  const isSuperAdminFromClaim = claims?.super_admin === true;
  const isSuperAdminFromVinculo = vinculos.some((v) => v.role === "SUPER_ADMIN");
  const isSuperAdmin = isSuperAdminFromClaim || isSuperAdminFromVinculo;

  const activeVinculo =
    vinculos.find((v) => v.condominioId === activeCondominioId) ?? null;

  const sessionData: Session = {
    uid,
    email: user?.email ?? null,
    displayName: user?.displayName ?? null,
    vinculos,
    activeCondominioId,
    isSuperAdmin,
    activeVinculo,
    claims,
  };

  if (process.env.NODE_ENV !== "production") {
    console.debug("DEBUG_CLAIMS_FROM_TOKEN", claims);
    console.debug("DEBUG_SESSION_BUILT", {
      isSuperAdmin: sessionData.isSuperAdmin,
      activeCondominioId: sessionData.activeCondominioId,
      activeRole: sessionData.activeVinculo?.role,
      vinculos: sessionData.vinculos.map((v) => ({ id: v.condominioId, role: v.role })),
    });
  }

  return sessionData;
}

export function useSession() {
  const { user, isUserLoading } = useUser();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const uid = user?.uid ?? null;

  const inflightRef = useRef<Promise<void> | null>(null);
  const inflightRefreshRef = useRef<Promise<void> | null>(null);

  const loadSession = useCallback(
    async (uid: string, force = false) => {
      try {
        const tokenResult = await fetchClaims(true);
        const claims = (tokenResult?.claims ?? {}) as Record<string, any>;

        const vinculos = await fetchVinculos(uid, force);

        const isSuperAdminTemp =
          claims?.super_admin === true || vinculos.some((v) => v.role === "SUPER_ADMIN");

        const activeCondominioId = pickActiveCondominio(uid, vinculos, isSuperAdminTemp);

        const s = buildSession({ uid, user, vinculos, activeCondominioId, claims });

        if (typeof window !== "undefined" && activeCondominioId) {
          localStorage.setItem(LS_ACTIVE_COND(uid), activeCondominioId);
        }

        setSession(s);
      } catch (e: any) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setSession(null);
      }
    },
    [user]
  );

  useEffect(() => {
    if (isUserLoading) return;

    if (!uid) {
      setSession(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (inflightRef.current) return;

    setLoading(true);
    setError(null);

    inflightRef.current = (async () => {
      await loadSession(uid, true);
      setLoading(false);
      inflightRef.current = null;
    })();
  }, [uid, isUserLoading, loadSession]);

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
      if (!uid || !user) return;

      if (typeof window !== "undefined") {
        localStorage.setItem(LS_ACTIVE_COND(uid), condominioId);
      }

      setSession((prev) => {
        if (!prev) return null;
        return buildSession({
          uid,
          user,
          vinculos: prev.vinculos,
          activeCondominioId: condominioId,
          claims: prev.claims,
        });
      });
    },
  };
}
