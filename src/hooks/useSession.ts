"use client";

import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import type { User } from "firebase/auth";
import { useUser, useClaims } from "@/firebase";

export type RoleKey = "SUPER_ADMIN" | "SINDICO" | "ADMIN" | "PORTEIRO" | "MORADOR";

/** SUPER ADMIN resolver (prioriza claim/email bootstrap) */
function isSuperAdminUser(user: User | null, claims: Record<string, any> | null) {
  const email = (user?.email || "").toLowerCase();
  return claims?.super_admin === true || email === "treecommunity@treetechautomation.com";
}

/**
 * Estado de sessão que o resto do app usa
 */
export type Session = {
  user: User;

  // Condomínio selecionado no app (quando aplicável)
  activeCondominioId: string | null;

  // Claims do Firebase Auth (ID token)
  claims: Record<string, any> | null;

  // Flag super admin já resolvida no front
  superAdmin: boolean;

  // Role efetivo do app (para menu/rotas)
  role: RoleKey;
};

export function useSessionBase() {
  const { user, isUserLoading } = useUser();
  const { claims, isClaimsLoading } = useClaims();

  const [activeCondominioId, setActiveCondominioId] = useState<string | null>(null);

  const session: Session | null = useMemo(() => {
    if (!user) return null;

    const superAdmin = isSuperAdminUser(user, (claims ?? null) as any);
    const role: RoleKey = superAdmin ? "SUPER_ADMIN" : "MORADOR";

    return {
      user,
      activeCondominioId,
      claims: (claims ?? null) as any,
      superAdmin,
      role,
    };
  }, [user, activeCondominioId, claims]);

  // Compat: mantém localStorage alinhado pro layout antigo / outros pontos
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!session) {
      window.localStorage.removeItem("treecondo_role");
      window.localStorage.removeItem("treecondo_condominioId");
      return;
    }

    window.localStorage.setItem("treecondo_role", session.role);
    if (session.activeCondominioId) {
      window.localStorage.setItem("treecondo_condominioId", session.activeCondominioId);
    } else {
      window.localStorage.removeItem("treecondo_condominioId");
    }
  }, [session?.role, session?.activeCondominioId, !!session]);

  const isSessionLoading = isUserLoading || isClaimsLoading;
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

/**
 * Hook público que o resto do código já usa.
 */
export function useSession() {
  return useSessionBase();
}
