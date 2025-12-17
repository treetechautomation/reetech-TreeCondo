import type { Session } from "@/hooks/useSession";

export type MenuModuleId =
  | "painel"
  | "anuncios"
  | "reservas"
  | "reunioes"
  | "incidentes"
  | "encomendas"
  | "documentos"
  | "enquetes"
  | "acesso"
  | "cadastros"
  | "condominios"
  | "administrador-global"
  | "configuracoes";

export type RoleKey = "SINDICO" | "MORADOR" | "PORTEIRO" | "SUPER_ADMIN";

export type MenuModule = {
  id: MenuModuleId;
  label: string;
  roles: Partial<Record<RoleKey, boolean>>;
};

/**
 * Lista base de módulos do menu.
 * Ajuste conforme sua necessidade (id/label).
 */
export const MENU_MODULES: MenuModule[] = [
  { id: "painel", label: "Painel", roles: { SINDICO: true, MORADOR: true, PORTEIRO: true } },
  { id: "anuncios", label: "Anúncios", roles: { SINDICO: true, MORADOR: true, PORTEIRO: false } },
  { id: "reservas", label: "Reservas", roles: { SINDICO: true, MORADOR: true, PORTEIRO: false } },
  { id: "reunioes", label: "Reuniões", roles: { SINDICO: true, MORADOR: true, PORTEIRO: false } },
  { id: "incidentes", label: "Incidentes", roles: { SINDICO: true, MORADOR: true, PORTEIRO: true } },
  { id: "encomendas", label: "Encomendas", roles: { SINDICO: true, MORADOR: true, PORTEIRO: true } },
  { id: "documentos", label: "Documentos", roles: { SINDICO: true, MORADOR: true, PORTEIRO: false } },
  { id: "enquetes", label: "Enquetes", roles: { SINDICO: true, MORADOR: true, PORTEIRO: false } },
  { id: "acesso", label: "Acesso", roles: { SINDICO: true, MORADOR: true, PORTEIRO: true } },
  { id: "cadastros", label: "Cadastros", roles: { SINDICO: true, MORADOR: false, PORTEIRO: false } },
  { id: "condominios", label: "Condomínios", roles: { SINDICO: false, MORADOR: false, PORTEIRO: false } },
  { id: "administrador-global", label: "Administrador Global", roles: { SINDICO: false, MORADOR: false, PORTEIRO: false } },
  { id: "configuracoes", label: "Configurações", roles: { SINDICO: true, MORADOR: true, PORTEIRO: true } },
];

/**
 * Retorna a role efetiva do usuário no condomínio ativo.
 * - Super admin sempre ganha.
 * - Senão usa a role do vínculo ativo.
 */
export function getEffectiveRole(session: Session | null): RoleKey | null {
  if (!session) return null;
  if (session.isSuperAdmin) return "SUPER_ADMIN";
  const r = session.activeVinculo?.role;
  return (r as RoleKey) ?? null;
}

/**
 * Filtra módulos visíveis conforme sessão.
 */
export function getVisibleMenuModules(session: Session | null): MenuModule[] {
  const role = getEffectiveRole(session);
  if (!role) return [];

  // SUPER_ADMIN vê tudo
  if (role === "SUPER_ADMIN") return MENU_MODULES;

  return MENU_MODULES.filter((m) => m.roles[role] === true);
}

/**
 * Checa se um módulo específico pode aparecer.
 */
export function canSeeModule(session: Session | null, moduleId: MenuModuleId): boolean {
  const role = getEffectiveRole(session);
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;

  const mod = MENU_MODULES.find((m) => m.id === moduleId);
  if (!mod) return false;

  return mod.roles[role] === true;
}
