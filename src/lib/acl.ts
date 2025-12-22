import type { Session, Role } from "@/hooks/useSession";

/**
 * Verifica se o usuário da sessão possui pelo menos um dos papéis exigidos.
 *
 * Hoje o único uso é:
 *   hasRole(session, ["SUPER_ADMIN"])
 * pra mostrar o menu "Administrador Global".
 *
 * A lógica:
 *  - Se não tiver sessão, retorna false.
 *  - Se session.isSuperAdmin === true, retorna true.
 *  - Se o e-mail for o treecommunity@treetechautomation.com, retorna true.
 *  - Senão, cruza requiredRoles com session.roles.
 */
export function hasRole(session: Session | null, requiredRoles: Role[]): boolean {
  if (!session) return false;

  const email = session.user.email ?? "";
  const roles = session.roles ?? [];
  const wantsSuperAdmin = requiredRoles.includes("SUPER_ADMIN");

  // Se a própria sessão já marcou como super admin, libera geral.
  if (session.isSuperAdmin) return true;

  // Regra extra de segurança: esse e-mail é sempre SUPER_ADMIN no front.
  if (wantsSuperAdmin && email === "treecommunity@treetechautomation.com") {
    return true;
  }

  // Interseção simples entre os papéis exigidos e os do usuário.
  return requiredRoles.some((role) => roles.includes(role));
}
