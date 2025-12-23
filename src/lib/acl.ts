import type { Session } from "@/hooks/useSession";

export type Role = "SUPER_ADMIN" | "ADMIN" | "SINDICO" | "PORTEIRO" | "MORADOR";

/**
 * ACL simples e compatível com o modelo atual:
 * - super admin: session.superAdmin (ou legado via any)
 * - e-mail fixo como SUPER_ADMIN (front)
 * - role do vínculo ativo: session.activeVinculo?.role (ou legado)
 */
export function hasRole(session: Session | null, requiredRoles: Role[]): boolean {
  if (!session) return false;

  const email = session.user?.email ?? "";

  const superAdmin =
    (session as any).superAdmin === true ||
    (session as any).isSuperAdmin === true ||
    (session as any).super_admin === true;

  if (superAdmin) return true;

  if (
    requiredRoles.includes("SUPER_ADMIN") &&
    email === "treecommunity@treetechautomation.com"
  ) {
    return true;
  }

  const activeVinculo =
    (session as any).activeVinculo ?? (session as any).vinculoAtivo ?? null;

  const role = activeVinculo?.role as Role | undefined;
  if (!role) return false;

  return requiredRoles.includes(role);
}
