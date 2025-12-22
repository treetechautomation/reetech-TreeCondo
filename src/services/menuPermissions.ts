import type { Session, SessionRole } from "@/hooks/useSession";

/**
 * Verifica se o usuário possui pelo menos um dos papéis exigidos.
 */
export function hasRole(
  session: Session | null | undefined,
  requiredRoles: SessionRole[]
): boolean {
  if (!session) return false;

  const userRoles = session.roles ?? [];

  // Retorna true se pelo menos um papel exigido existir na lista do usuário
  return requiredRoles.some((role) => userRoles.includes(role));
}

/**
 * Helper específico para ver se o usuário é SUPER_ADMIN.
 */
export function isSuperAdmin(session: Session | null | undefined): boolean {
  return hasRole(session, ["SUPER_ADMIN"]);
}
