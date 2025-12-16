import type { Session, Role } from "@/hooks/useSession";

/**
 * Verifica se o usuário na sessão atual possui um dos papéis (roles) fornecidos.
 * Leva em conta a role do SUPER_ADMIN e a role do vínculo ativo.
 * @param session - O objeto da sessão atual.
 * @param roles - Um array de `Role` para verificar.
 * @returns `true` se o usuário tiver uma das roles, `false` caso contrário.
 */
export function hasRole(session: Session | null, roles: Role[]): boolean {
  if (!session) return false;

  // SUPER_ADMIN sempre tem acesso
  if (session.isSuperAdmin) return true;

  // Se não houver vínculo ativo, não há role para verificar (exceto SUPER_ADMIN)
  if (!session.activeVinculo) return false;
  
  // Verifica se a role do vínculo ativo está na lista de roles permitidas
  return roles.includes(session.activeVinculo.role);
}

/**
 * Verifica se o usuário pode acessar um condomínio específico.
 * @param session - O objeto da sessão atual.
 * @param condominioId - O ID do condomínio a ser verificado.
 * @returns `true` se o usuário tiver acesso, `false` caso contrário.
 */
export function canAccessCondominio(session: Session | null, condominioId: string): boolean {
  if (!session) return false;

  // SUPER_ADMIN sempre tem acesso
  if (session.isSuperAdmin) return true;

  // Verifica se existe um vínculo para o condomínio especificado
  return session.vinculos.some(v => v.condominioId === condominioId && v.ativo);
}

/**
 * Verifica se o usuário pode acessar um bloco específico dentro de um condomínio.
 * @param session - O objeto da sessão atual.
 * @param condominioId - O ID do condomínio.
 * @param blocoId - O ID do bloco a ser verificado.
 * @returns `true` se o usuário tiver acesso, `false` caso contrário.
 */
export function canAccessBloco(session: Session | null, condominioId: string, blocoId: string): boolean {
    if (!session) return false;

    // SUPER_ADMIN sempre tem acesso
    if (session.isSuperAdmin) return true;

    // Encontra o vínculo relevante para o condomínio
    const vinculo = session.vinculos.find(v => v.condominioId === condominioId && v.ativo);
    if (!vinculo) return false;

    const scope = vinculo.scope;

    // Roles com acesso a nível de condomínio podem ver todos os blocos
    if (scope?.type === 'CONDOMINIO' && ['ADMIN_CONDOMINIO', 'SINDICO'].includes(vinculo.role)) {
        return true;
    }
    
    // Roles com acesso a nível de bloco só podem ver o bloco específico
    if (scope?.type === 'BLOCO' && scope.blocoId === blocoId) {
        return true;
    }

    // Outros casos (ex: morador)
    if (vinculo.role === 'MORADOR' && vinculo.scope?.type === 'UNIDADE' && vinculo.scope.blocoId === blocoId) {
        return true;
    }

    return false;
}
