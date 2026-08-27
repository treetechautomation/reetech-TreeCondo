/**
 * TreeCondo Design System — Visual Tokens
 *
 * Centralized design tokens for the TreeCondo Dark Premium theme.
 * Reused across ALL modules for visual consistency.
 *
 * @module tokens
 */

/* ── Colors ── */
export const COLORS = {
  accent: "#00D0E6",
  accentHover: "#00B4CC",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  violet: "#8b5cf6",
  neutral: "#6b7280",
} as const;

/* ── Backgrounds ── */
export const BG = {
  page: "bg-slate-950",
  card: "bg-slate-900/60 backdrop-blur-xl",
  cardSolid: "bg-slate-900",
  cardHover: "hover:bg-white/[0.04]",
  surface: "bg-white/[0.02]",
  elevated: "bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.3)]",
  header: "bg-white/[0.01]",
} as const;

/* ── Borders ── */
export const BORDER = {
  subtle: "border-white/[0.06]",
  medium: "border-white/10",
  accent: "border-[#00D0E6]/20",
  accentHover: "hover:border-[#00D0E6]/20",
  dashed: "border-dashed border-white/10",
} as const;

/* ── Radius ── */
export const RADIUS = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
  full: "rounded-full",
} as const;

/* ── Shadows ── */
export const SHADOW = {
  card: "shadow-[0_8px_30px_rgba(0,0,0,0.3)]",
  cardHover: "hover:shadow-[0_8px_40px_rgba(0,208,230,0.06)]",
  elevated: "shadow-[0_8px_30px_rgba(0,0,0,0.2)]",
  fab: "shadow-[0_8px_30px_rgba(0,208,230,0.3)]",
  fabHover: "hover:shadow-[0_8px_40px_rgba(0,208,230,0.4)]",
} as const;

/* ── Transitions ── */
export const TRANSITION = {
  fast: "transition-all duration-150",
  normal: "transition-all duration-300",
  slow: "transition-all duration-500",
} as const;

/* ── Text ── */
export const TEXT = {
  primary: "text-white",
  secondary: "text-white/60",
  tertiary: "text-white/40",
  disabled: "text-white/20",
  accent: "text-[#00D0E6]",
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
  xs: "text-[10px]",
  sm: "text-[11px]",
  base: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
} as const;

/* ── Composite Card Styles ── */
export const CARD_STYLE = [
  BORDER.subtle,
  BG.card,
  SHADOW.card,
  BORDER.accentHover,
  SHADOW.cardHover,
  TRANSITION.normal,
  RADIUS.lg,
].join(" ");

export const CARD_PREMIUM_STYLE = [
  BORDER.subtle,
  BG.elevated,
  BORDER.accentHover,
  "hover:shadow-[0_8px_40px_rgba(0,208,230,0.06)]",
  TRANSITION.normal,
  RADIUS.lg,
].join(" ");

/* ── Animation ── */
export const ANIM = {
  fadeIn: "animate-in fade-in duration-300",
  slideUp: "animate-in fade-in slide-in-from-bottom-2 duration-500",
  slideDown: "animate-in fade-in slide-in-from-bottom-4 duration-300",
} as const;

/* ── Focus ── */
export const FOCUS = "focus:outline-none focus:ring-2 focus:ring-[#00D0E6]/50";

/* ── Common KPI accent configs ── */
export const KPI_ACCENTS = {
  ciano: { accentClass: "text-[#00D0E6]", accentBg: "bg-[#00D0E6]/10" },
  red: { accentClass: "text-red-500", accentBg: "bg-red-500/10" },
  emerald: { accentClass: "text-emerald-500", accentBg: "bg-emerald-500/10" },
  amber: { accentClass: "text-amber-500", accentBg: "bg-amber-500/10" },
  violet: { accentClass: "text-violet-500", accentBg: "bg-violet-500/10" },
  slate: { accentClass: "text-slate-400", accentBg: "bg-slate-400/10" },
  blue: { accentClass: "text-blue-500", accentBg: "bg-blue-500/10" },
  orange: { accentClass: "text-orange-500", accentBg: "bg-orange-500/10" },
} as const;

export type KpiAccentKey = keyof typeof KPI_ACCENTS;
