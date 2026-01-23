import type { Session } from "@/hooks/useSession";

export type Role = "SUPER_ADMIN" | "ADMIN" | "ADMIN_CONDOMINIO" | "SINDICO" | "PORTEIRO" | "ZELADOR" | "MORADOR";

/**
 * ACL simples e robusta baseada na role resolvida da sessão.
 */
export function hasRole(session: Session | null, requiredRoles: Role[]): boolean {
  if (!session) return false;

  // A session.role já é a role resolvida (SUPER_ADMIN ou a role do vínculo ativo).
  // A session.superAdmin também já é a fonte da verdade para Super Admin.
  const userRole = session.role;

  if (session.superAdmin && requiredRoles.includes("SUPER_ADMIN")) {
    return true;
  }
  
  if (userRole && requiredRoles.includes(userRole)) {
    return true;
  }

  return false;
}
