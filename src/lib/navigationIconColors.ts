/**
 * UI.G7.1 — CONTRATO DE CORES SEMÂNTICAS DOS ÍCONES DE NAVEGAÇÃO
 *
 * Cada domínio funcional possui uma cor reconhecível.
 * O estado ativo continua usando o accent TreeCondo (#00d0e6).
 */

import type { MenuKey } from "@/lib/menuPermissions";

export const NAV_ICON_COLORS: Partial<Record<MenuKey, string>> = {
  dashboard: "#38BDF8",
  portaria: "#00BEEA",
  condominios: "#38BDF8",
  cadastros: "#60A5FA",
  meus_dados: "#818CF8",
  acesso: "#22D3EE",
  anuncios: "#00BEEA",
  reservas: "#22C55E",
  reservas_gestao: "#F59E0B",
  reservas_solicitacoes: "#F59E0B",
  reservas_agenda: "#22C55E",
  reservas_checkin: "#22C55E",
  incidentes: "#F87171",
  encomendas: "#A78BFA",
  documentos: "#FBBF24",
  enquetes: "#C084FC",
  reunioes: "#F472B6",
  manutencao_preventiva: "#FB923C",
  configuracoes: "#94A3B8",
  administrador_global: "#00BEEA",
  comunidade: "#2DD4BF",
  financeiro: "#34D399",
  whatsapp_logs: "#A78BFA",
};

export function navIconColor(key: string): string {
  return (NAV_ICON_COLORS as Record<string, string | undefined>)[key] ?? "#94A3B8";
}
