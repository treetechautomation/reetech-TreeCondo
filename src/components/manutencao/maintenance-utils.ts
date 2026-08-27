import {
  Clock,
  CheckCircle,
  Loader,
  AlertTriangle,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type ExecStatus = "PROGRAMADA" | "EM_ANDAMENTO" | "CONCLUIDA";
export type ViewMode = "list" | "calendar" | "kanban";

export interface ExecItem {
  id: string;
  rotinaId?: string;
  titulo?: string;
  categoria?: string;
  fornecedorNome?: string;
  status: string;
  dataProgramada?: any;
  dataExecutadaEm?: any;
  proximaProgramadaEm?: any;
}

export function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  return null;
}

export function formatDateBR(v: any): string {
  const d = toDate(v);
  if (!d) return "-";
  return d.toLocaleDateString("pt-BR");
}

export function formatDateShort(v: any): string {
  const d = toDate(v);
  if (!d) return "-";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatDateRelative(v: any): string {
  const d = toDate(v);
  if (!d) return "-";
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff < 0) return `Atrasada (${Math.abs(diff)}d)`;
  return `Em ${diff} dias`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function normalize(v: string | null | undefined): string {
  return String(v ?? "").trim().toUpperCase();
}

export function getStatusConfig(status: string): {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  text: string;
  order: number;
} {
  const s = normalize(status);
  const configs: Record<string, { label: string; icon: LucideIcon; color: string; bg: string; border: string; text: string; order: number }> = {
    PROGRAMADA: {
      label: "Programada",
      icon: Clock,
      color: "#3b82f6",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-400",
      order: 0,
    },
    EM_ANDAMENTO: {
      label: "Em andamento",
      icon: Loader,
      color: "#f97316",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      text: "text-orange-400",
      order: 1,
    },
    CONCLUIDA: {
      label: "Concluída",
      icon: CheckCircle,
      color: "#10b981",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      text: "text-emerald-400",
      order: 3,
    },
    ATRASADA: {
      label: "Atrasada",
      icon: AlertTriangle,
      color: "#ef4444",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      text: "text-red-400",
      order: -1,
    },
  };
  return (
    configs[s] ?? {
      label: `Desconhecido (${s || "?"})`,
      icon: HelpCircle,
      color: "#6b7280",
      bg: "bg-slate-500/10",
      border: "border-slate-500/20",
      text: "text-slate-400",
      order: 99,
    }
  );
}

export function isAtrasada(item: ExecItem): boolean {
  const d = toDate(item.dataProgramada);
  if (!d) return false;
  const s = normalize(item.status);
  if (s === "CONCLUIDA") return false;
  return startOfDay(d) < startOfDay(new Date());
}

export const STATUS_FILTERS: { key: string; label: string; status?: string[] }[] = [
  { key: "all", label: "Todas" },
  { key: "hoje", label: "Hoje" },
  { key: "proximos7d", label: "Próx. 7 dias" },
  { key: "atrasadas", label: "Atrasadas" },
  { key: "em_andamento", label: "Em andamento", status: ["EM_ANDAMENTO"] },
  { key: "concluidas", label: "Concluídas", status: ["CONCLUIDA"] },
];

export const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: "list", label: "Lista" },
  { key: "calendar", label: "Calendário" },
  { key: "kanban", label: "Kanban" },
];

export const KANBAN_COLUMNS = [
  { status: "PROGRAMADA", label: "Programadas" },
  { status: "EM_ANDAMENTO", label: "Em andamento" },
  { status: "CONCLUIDA", label: "Concluídas" },
] as const;

export const ITEMS_PER_PAGE = 15;

export const CARD_STYLE =
  "border-white/[0.06] bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:border-[#00D0E6]/20 hover:shadow-[0_8px_40px_rgba(0,208,230,0.06)] transition-all duration-300 rounded-2xl";

export const ANIM_STYLE = "animate-in fade-in slide-in-from-bottom-2 duration-300";
