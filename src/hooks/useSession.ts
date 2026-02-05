
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { User } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { useUser, useClaims, useFirestore } from "@/firebase";

export type RoleKey = "SUPER_ADMIN" | "SINDICO" | "ADMIN" | "ADMIN_CONDOMINIO" | "PORTEIRO" | "ZELADOR" | "MORADOR";
export type VinculoRole = "SINDICO" | "MORADOR" | "PORTEIRO" | "ZELADOR" | "ADMIN" | "ADMIN_CONDOMINIO";

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

function isSuperAdminUser(user: User | null, claims: Record<string, any> | null): boolean {
  if (!user) return false;
  const email = (user.email || "").toLowerCase();
  if (email === "treecommunity@treetechautomation.com") return true;
  if (claims?.super_admin === true) return true;
  if (claims?.superAdmin === true) return true;
  return false;
}

function resolveRole(superAdmin: boolean, vinculoAtivo: Vinculo | null): RoleKey {
  if (superAdmin) return "SUPER_ADMIN";
  if (!vinculoAtivo) return "MORADOR"; // Fallback seguro
  if (vinculoAtivo.role === "SINDICO") return "SINDICO";
  if (vinculoAtivo.role === "PORTEIRO") return "PORTEIRO";
  if (vinculoAtivo.role === "ZELADOR") return "ZELADOR";
  if (vinculoAtivo.role === "ADMIN_CONDOMINIO") return "ADMIN_CONDOMINIO";
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

  const [activeCondominioId, setActiveCondominioIdInternal] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LS_CONDO);
  });

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
    if (isUserLoading || isClaimsLoading || isVinculosLoading) return;
    if (!user) {
      setActiveCondominioIdInternal(null);
      return;
    }

    const isSuper = isSuperAdminUser(user, claims);
    
    // Non-super-admins are locked to their first available condo
    if (!isSuper) {
      if (vinculos.length > 0 && vinculos[0].condominioId !== activeCondominioId) {
        setActiveCondominioIdInternal(vinculos[0].condominioId);
      } else if (vinculos.length === 0) {
        setActiveCondominioIdInternal(null);
      }
      return;
    }

    // For super admins, respect their choice in localStorage if it's valid
    const savedCondo = typeof window !== 'undefined' ? window.localStorage.getItem(LS_CONDO) : null;
    if (savedCondo && savedCondo !== activeCondominioId) {
        setActiveCondominioIdInternal(savedCondo);
    } else if (!savedCondo && vinculos.length > 0 && activeCondominioId !== vinculos[0].condominioId) {
        // Fallback to first vinculo if no LS entry
        setActiveCondominioIdInternal(vinculos[0].condominioId);
    }
    
  }, [user, isUserLoading, claims, isClaimsLoading, vinculos, isVinculosLoading, activeCondominioId]);

  const setActiveCondominioId = useCallback((id: string | null) => {
    setActiveCondominioIdInternal(id);
    if (typeof window !== "undefined") {
      if (id) {
        window.localStorage.setItem(LS_CONDO, id);
      } else {
        window.localStorage.removeItem(LS_CONDO);
      }
    }
  }, []);

  const session: Session | null = useMemo(() => {
    if (!user) return null;

    const superAdmin = isSuperAdminUser(user, claims ?? null);
    const vinculoAtivo = activeCondominioId
      ? vinculos.find((v) => v.condominioId === activeCondominioId) ?? null
      : null;
    
    const role = resolveRole(superAdmin, vinculoAtivo);
    
    return {
      user,
      activeCondominioId,
      claims: (claims ?? null) as any,
      superAdmin,
      role,
      vinculos,
    };
  }, [user, claims, activeCondominioId, vinculos]);
  
  // Sincroniza role com localStorage para uso em outros contextos, se necessário
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session?.role) {
      window.localStorage.setItem(LS_ROLE, session.role);
    } else {
      window.localStorage.removeItem(LS_ROLE);
    }
  }, [session?.role]);

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
