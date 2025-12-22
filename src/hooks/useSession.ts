"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useUser, useClaims } from "@/firebase";

/**
 * Papéis suportados na aplicação.
 * Ajuste aqui se criar novos tipos de usuário depois.
 */
export type Role = "SUPER_ADMIN" | "SINDICO" | "MORADOR" | "PORTEIRO";

/**
 * Estrutura dos vinculos que podem vir em custom claims.
 * (Deixamos bem genérico pra não quebrar nada.)
 */
export type VinculoScope = "GLOBAL" | "CONDOMINIO" | "BLOCO" | "UNIDADE";

export interface VinculoClaim {
  condominioId: string;
  role: Role;
  scope?: VinculoScope;
  blocoId?: string;
  unidadeId?: string;
}

export interface SessionClaims {
  super_admin?: boolean;
  roles?: Role[];
  vinculos?: VinculoClaim[];
  // Qualquer outra coisa que você queira colocar nos claims
  [key: string]: any;
}

export interface ActiveVinculo {
  condominioId: string | null;
  role: Role;
  scope: VinculoScope;
  blocoId?: string | null;
  unidadeId?: string | null;
}

/**
 * Sessão “rica” que o resto da aplicação vai consumir.
 */
export interface Session {
  user: User;
  claims: SessionClaims | null;
  isSuperAdmin: boolean;
  roles: Role[];
  activeVinculo: ActiveVinculo | null;
  activeCondominioId: string | null;
}

export interface UseSessionResult {
  session: Session | null;
  isSessionLoading: boolean;
  refreshClaims: () => Promise<void>;
}

const SUPER_ADMIN_EMAIL = "treecommunity@treetechautomation.com";

export function useSession(): UseSessionResult {
  const { user, isUserLoading } = useUser();
  const { claims, isClaimsLoading, refreshClaims } = useClaims();

  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  useEffect(() => {
    // Enquanto user/claims estão carregando
    if (isUserLoading || isClaimsLoading) {
      setIsSessionLoading(true);
      return;
    }

    // Não logado
    if (!user) {
      setSession(null);
      setIsSessionLoading(false);
      return;
    }

    const c = (claims || {}) as SessionClaims;

    const rolesFromClaims = Array.isArray(c.roles) ? (c.roles as Role[]) : [];
    const hasSuperAdminClaim =
      c.super_admin === true || rolesFromClaims.includes("SUPER_ADMIN");

    // REGRA ESPECIAL: esse e-mail é sempre SUPER_ADMIN no front
    const isEmailSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

    const isSuperAdmin = hasSuperAdminClaim || isEmailSuperAdmin;

    // Monta um activeVinculo simples (GLOBAL) para super admin
    const activeVinculo: ActiveVinculo | null = isSuperAdmin
      ? {
          condominioId: null,
          role: "SUPER_ADMIN",
          scope: "GLOBAL",
          blocoId: null,
          unidadeId: null,
        }
      : null;

    const activeCondominioId = activeVinculo?.condominioId ?? null;

    setSession({
      user,
      claims: c,
      isSuperAdmin,
      roles: isSuperAdmin
        ? (Array.from(new Set(["SUPER_ADMIN", ...rolesFromClaims])) as Role[])
        : rolesFromClaims,
      activeVinculo,
      activeCondominioId,
    });

    setIsSessionLoading(false);
  }, [user, isUserLoading, claims, isClaimsLoading]);

  return {
    session,
    isSessionLoading,
    refreshClaims,
  };
}
