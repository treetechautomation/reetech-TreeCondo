
"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { useUser, useClaims, useFirestore } from "@/firebase";

export type RoleKey = "SUPER_ADMIN" | "SINDICO" | "ADMIN" | "PORTEIRO" | "MORADOR";
export type VinculoRole = "SINDICO" | "MORADOR" | "PORTEIRO" | "ADMIN";

export type Vinculo = {
  condominioId: string;
  role: VinculoRole;
  blocoId?: string | null;
  unidadeId?: string | null;
  status: "ATIVO" | "INATIVO";
};

type UserDoc = {
  displayName?: string;
  email?: string;
  vinculos?: Vinculo[];
};

function isSuperAdminUser(user: User | null, claims: Record<string, any> | null) {
  const email = (user?.email || "").toLowerCase();
  return claims?.super_admin === true || email === "treecommunity@treetechautomation.com";
}

function resolveRole(superAdmin: boolean, vinculoAtivo: Vinculo | null): RoleKey {
  if (superAdmin) return "SUPER_ADMIN";
  if (!vinculoAtivo) return "MORADOR"; // Fallback seguro
  if (vinculoAtivo.role === "SINDICO") return "SINDICO";
  if (vinculoAtivo.role === "PORTEIRO") return "PORTEIRO";
  if (vinculoAtivo.role === "ADMIN") return "ADMIN";
  return "MORADOR";
}

const LS_CONDO = "treecondo_condominioId";
const LS_ROLE = "treecondo_role";

export type Session = {
  user: User;
  activeCondominioId: string | null;
  claims: Record<string, any> | null;
  superAdmin: boolean;
  role: RoleKey;
  vinculos: Vinculo[];
};

export function useSessionBase() {
  const { user, isUserLoading } = useUser();
  const { claims, isClaimsLoading } = useClaims();
  const firestore = useFirestore();

  const [activeCondominioId, setActiveCondominioId] = useState<string | null>(null);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [isVinculosLoading, setIsVinculosLoading] = useState(true);

  // Carrega userCondominios/{uid}/vinculos[]
  useEffect(() => {
    if (!user || !firestore) {
      setVinculos([]);
      setIsVinculosLoading(false);
      return;
    }

    setIsVinculosLoading(true);
    const vinculosRef = collection(firestore, "userCondominios", user.uid, "vinculos");
    const q = query(vinculosRef);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Vinculo)
          .filter((v) => v.status === "ATIVO");
        setVinculos(list);
        setIsVinculosLoading(false);
        console.log('[useSession] Vínculos carregados:', list.length);
      },
      (err) => {
        console.error("[useSession] erro ao carregar userCondominios/{uid}/vinculos:", { code: (err as any)?.code, message: (err as any)?.message, err });
        setVinculos([]);
        setIsVinculosLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, firestore]);

  // Resolve condomínio ativo
  useEffect(() => {
    // Só roda quando todos os dados estiverem prontos
    if (isUserLoading || isClaimsLoading || isVinculosLoading) return;
    if (!user) {
      setActiveCondominioId(null);
      return;
    }

    const isSuper = isSuperAdminUser(user, claims);
    console.log('[useSession] Resolvendo condomínio ativo. isSuperAdmin:', isSuper, 'Vínculos:', vinculos.length);

    // Para SUPER_ADMIN, a seleção é manual e persistida no localStorage, não baseada em vínculos.
    if (isSuper) {
        const savedCondo = typeof window !== 'undefined' ? window.localStorage.getItem(LS_CONDO) : null;
        if (savedCondo && savedCondo !== activeCondominioId) {
            setActiveCondominioId(savedCondo);
        }
        return;
    }

    // Para usuários comuns, a lógica se baseia nos vínculos.
    if (vinculos.length > 0) {
        const savedCondo = typeof window !== 'undefined' ? window.localStorage.getItem(LS_CONDO) : null;
        
        const hasSavedCondoInVinculos = vinculos.some(v => v.condominioId === savedCondo);
        const hasActiveCondoInVinculos = vinculos.some(v => v.condominioId === activeCondominioId);

        if (activeCondominioId && hasActiveCondoInVinculos) {
            // O condomínio ativo atual é válido, não faz nada.
        } else if (savedCondo && hasSavedCondoInVinculos) {
            setActiveCondominioId(savedCondo);
        } else {
            // Se nenhum salvo ou ativo é válido, define o primeiro da lista.
            setActiveCondominioId(vinculos[0].condominioId);
        }
    } else {
        // Se não tem vínculos, não tem condomínio ativo.
        setActiveCondominioId(null);
    }
  }, [user, isUserLoading, claims, isClaimsLoading, vinculos, isVinculosLoading, activeCondominioId]);

  const session: Session | null = useMemo(() => {
    if (!user) return null;

    const superAdmin = isSuperAdminUser(user, claims ?? null);
    const vinculoAtivo = activeCondominioId
      ? vinculos.find((v) => v.condominioId === activeCondominioId) ?? null
      : null;
    
    const role = resolveRole(superAdmin, vinculoAtivo);
    console.log('[useSession] Session recalculada. Role:', role, 'SuperAdmin:', superAdmin, 'CondoId:', activeCondominioId);

    return {
      user,
      activeCondominioId,
      claims: (claims ?? null) as any,
      superAdmin,
      role,
      vinculos,
    };
  }, [user, claims, activeCondominioId, vinculos]);

  // Sincroniza com localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (activeCondominioId) {
      window.localStorage.setItem(LS_CONDO, activeCondominioId);
    } else {
      window.localStorage.removeItem(LS_CONDO);
    }
    if (session?.role) {
      window.localStorage.setItem(LS_ROLE, session.role);
    } else {
      window.localStorage.removeItem(LS_ROLE);
    }
  }, [session?.role, activeCondominioId]);

  const isSessionLoading = isUserLoading || isClaimsLoading || isVinculosLoading;
  const isAuthenticated = !!user;

  return {
    session,
    user: user ?? null,
    isSessionLoading,
    isUserLoading,
    isAuthenticated,
    activeCondominioId,
    setActiveCondominioId,
    claims: (claims ?? null) as any,
  };
}


export function useSession() {
  return useSessionBase();
}
