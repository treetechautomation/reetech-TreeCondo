/**
 * F.2.6 — MENU PERMISSIONS CANÔNICAS
 *
 * Single source of truth para buildMenuPermissions(role).
 * Unifica as 4 implementações anteriores.
 *
 * Baseada na versão mais completa (finalizar-primeiro-acesso),
 * com adição de ZELADOR e tratamento de FUNCIONARIO.
 */

import type { VinculoRole } from "./types";

export type MenuKey =
  | "dashboard"
  | "acesso"
  | "anuncios"
  | "documentos"
  | "enquetes"
  | "reservas"
  | "encomendas"
  | "reunioes"
  | "incidentes"
  | "cadastros"
  | "configuracoes"
  | "condominios"
  | "administradorGlobal";

export type MenuPermissions = Partial<Record<MenuKey, boolean>> & { dashboard: boolean };

const BASE = { dashboard: true } as const;

const MORADOR_PERMS: MenuPermissions = {
  ...BASE,
  acesso: true,
  anuncios: true,
  documentos: true,
  enquetes: true,
  reservas: true,
  encomendas: true,
  reunioes: true,
  cadastros: false,
  configuracoes: false,
  condominios: false,
  administradorGlobal: false,
  incidentes: false,
};

const PORTEIRO_PERMS: MenuPermissions = {
  ...BASE,
  acesso: true,
  encomendas: true,
  incidentes: true,
  anuncios: true,
  documentos: true,
  cadastros: false,
  configuracoes: false,
  condominios: false,
  reservas: false,
  enquetes: false,
  reunioes: false,
  administradorGlobal: false,
};

const GESTOR_PERMS: MenuPermissions = {
  dashboard: true,
  condominios: true,
  cadastros: true,
  configuracoes: true,
  anuncios: true,
  documentos: true,
  enquetes: true,
  reservas: true,
  encomendas: true,
  incidentes: true,
  reunioes: true,
  acesso: true,
  administradorGlobal: false,
};

const ZELADOR_PERMS: MenuPermissions = {
  ...BASE,
  acesso: true,
  encomendas: true,
  incidentes: true,
  anuncios: true,
  documentos: true,
  cadastros: false,
  configuracoes: false,
  condominios: false,
  reservas: false,
  enquetes: false,
  reunioes: false,
  administradorGlobal: false,
};

export function buildMenuPermissions(role: string): MenuPermissions {
  const r = String(role || "").toUpperCase();

  if (r === "MORADOR") return { ...MORADOR_PERMS };
  if (r === "PORTEIRO") return { ...PORTEIRO_PERMS };
  if (r === "ZELADOR" || r === "FUNCIONARIO" || r === "SEGURANCA") return { ...ZELADOR_PERMS };
  if (r === "SINDICO" || r === "ADMIN" || r === "ADMIN_CONDOMINIO" || r === "SUPER_ADMIN") return { ...GESTOR_PERMS };

  return { ...BASE };
}
