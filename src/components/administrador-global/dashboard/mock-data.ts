import type { LucideIcon } from "lucide-react";
import {
  Users,
  Building2,
  Package,
  Rocket,
  LifeBuoy,
  CalendarClock,
  AlertTriangle,
  UserPlus,
  FileText,
  UserCheck,
  UsersRound,
  Megaphone,
  ShieldAlert,
  PackageCheck,
} from "lucide-react";
import type { GlobalDashboardData } from "@/services/globalDashboard";

export type StatAccent = "cyan" | "emerald" | "amber" | "violet" | "rose" | "slate";

export type DashboardStat = {
  key: string;
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  accent: StatAccent;
};

/**
 * Metadados dos seis indicadores reais retornados por GET /api/global/dashboard (G1.4/G1.5).
 * O valor de cada card vem da API — aqui só rótulo, ícone e cor.
 */
export type RealStatMeta = {
  key: keyof GlobalDashboardData;
  label: string;
  hint: string;
  icon: LucideIcon;
  accent: StatAccent;
};

export const REAL_STATS_META: RealStatMeta[] = [
  { key: "totalCondominios", label: "Condomínios", hint: "cadastrados na base", icon: Building2, accent: "emerald" },
  { key: "totalUsuarios", label: "Usuários cadastrados", hint: "contas na plataforma", icon: UserCheck, accent: "cyan" },
  { key: "totalMembros", label: "Membros cadastrados", hint: "vínculos em condomínios", icon: UsersRound, accent: "violet" },
  { key: "totalAnunciosAtivos", label: "Comunicados publicados", hint: "status PUBLICADO", icon: Megaphone, accent: "amber" },
  { key: "totalIncidentesAbertos", label: "Incidentes abertos", hint: "status ABERTO", icon: ShieldAlert, accent: "rose" },
  { key: "totalEncomendasPendentes", label: "Encomendas pendentes", hint: "aguardando retirada", icon: PackageCheck, accent: "slate" },
];

/**
 * Indicadores comerciais — ainda sem fonte real global (Cliente/Produto/Implantação
 * não existem como entidades no cockpit). Sempre renderizados com StatCard demo=true.
 */
export const MOCK_STATS: DashboardStat[] = [
  { key: "clientes", label: "Clientes", value: 127, hint: "+4 este mês", icon: Users, accent: "cyan" },
  { key: "produtos-ativos", label: "Produtos ativos", value: 6, hint: "no catálogo Treetech", icon: Package, accent: "violet" },
  { key: "implantacoes", label: "Implantações", value: 9, hint: "em andamento", icon: Rocket, accent: "amber" },
  { key: "chamados", label: "Chamados", value: 14, hint: "em aberto", icon: LifeBuoy, accent: "rose" },
  { key: "renovacoes", label: "Renovações próximas", value: 5, hint: "próximos 30 dias", icon: CalendarClock, accent: "cyan" },
  { key: "alertas", label: "Alertas", value: 3, hint: "requerem atenção", icon: AlertTriangle, accent: "rose" },
];

export type DashboardActivity = {
  id: string;
  label: string;
  detail: string;
  time: string;
};

export const MOCK_ACTIVITIES: DashboardActivity[] = [
  { id: "1", label: "Novo cliente cadastrado", detail: "Cliente Alpha Empreendimentos", time: "há 2 horas" },
  { id: "2", label: "Condomínio vinculado", detail: "Residencial Bosque Verde → Cliente Beta", time: "há 5 horas" },
  { id: "3", label: "Renovação registrada", detail: "Contrato TreeCondo — Cliente Gamma", time: "ontem" },
  { id: "4", label: "Produto ativado", detail: "TreeMídia habilitado para Cliente Delta", time: "há 2 dias" },
  { id: "5", label: "Chamado aberto", detail: "Suporte nível 2 — Cliente Epsilon", time: "há 3 dias" },
];

export type QuickAction = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export const MOCK_QUICK_ACTIONS: QuickAction[] = [
  { key: "novo-cliente", label: "Novo Cliente", icon: UserPlus },
  { key: "nova-implantacao", label: "Nova Implantação", icon: Rocket },
  { key: "nova-proposta", label: "Nova Proposta", icon: FileText },
  { key: "novo-ticket", label: "Novo Ticket", icon: LifeBuoy },
];
