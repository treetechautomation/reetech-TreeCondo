import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Briefcase,
  Rocket,
  CreditCard,
  Wallet,
  LifeBuoy,
  Activity,
  ShieldAlert,
} from "lucide-react";

export type CockpitNavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
};

export type CockpitNavGroup = {
  key: string;
  label: string;
  items: CockpitNavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

/**
 * Estrutura oficial de menu da G1 (ver Master Plan / G1.0).
 * Itens com enabled=false ainda não têm rota implementada —
 * não devem ser navegáveis (evita links mortos).
 */
export const COCKPIT_NAV_GROUPS: CockpitNavGroup[] = [
  {
    key: "visao-geral",
    label: "Visão Geral",
    items: [
      {
        key: "dashboard",
        label: "Dashboard Operacional",
        href: "/administrador-global/dashboard",
        icon: LayoutDashboard,
        enabled: true,
      },
    ],
  },
  {
    key: "plataforma",
    label: "Plataforma",
    items: [
      { key: "clientes", label: "Clientes", href: "/administrador-global/clientes", icon: Users, enabled: true },
      { key: "condominios", label: "Condomínios", href: "/administrador-global/condominios", icon: Building2, enabled: false },
      { key: "produtos", label: "Produtos", href: "/administrador-global/produtos", icon: Package, enabled: false },
    ],
  },
  {
    key: "governanca",
    label: "Governança",
    items: [
      { key: "auditoria", label: "Auditoria", href: "/administrador-global/auditoria", icon: ScrollText, enabled: false },
      { key: "acl", label: "Editor de Permissões (ACL)", href: "/administrador-global", icon: ShieldCheck, enabled: true },
      { key: "configuracoes", label: "Configurações", href: "/administrador-global/configuracoes", icon: Settings, enabled: false },
    ],
  },
  {
    key: "planejado",
    label: "Planejado",
    collapsible: true,
    defaultOpen: false,
    items: [
      { key: "comercial", label: "Comercial", href: "#", icon: Briefcase, enabled: false },
      { key: "implantacoes", label: "Implantações", href: "#", icon: Rocket, enabled: false },
      { key: "planos", label: "Planos", href: "#", icon: CreditCard, enabled: false },
      { key: "financeiro", label: "Financeiro", href: "#", icon: Wallet, enabled: false },
      { key: "suporte", label: "Suporte", href: "#", icon: LifeBuoy, enabled: false },
      { key: "monitoramento", label: "Monitoramento", href: "#", icon: Activity, enabled: false },
      { key: "seguranca-avancada", label: "Segurança avançada", href: "#", icon: ShieldAlert, enabled: false },
    ],
  },
];
