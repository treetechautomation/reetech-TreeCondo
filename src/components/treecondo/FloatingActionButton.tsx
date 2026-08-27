"use client";

import * as React from "react";
import { Plus, type LucideIcon } from "lucide-react";
import { COLORS, SHADOW, RADIUS } from "./tokens";

/**
 * FloatingActionButton — Standard FAB with animation, hover scale, and tooltip.
 * Reused from Manutenção Preventiva design system.
 *
 * @example
 * <FloatingActionButton onClick={() => router.push("/rotinas")} label="Nova Rotina" />
 * <FloatingActionButton onClick={handleAction} icon={FileText} label="Novo Documento" />
 */
export interface FloatingActionButtonProps {
  onClick: () => void;
  label: string;
  icon?: LucideIcon;
  ariaLabel?: string;
  color?: string;
  hoverColor?: string;
}

export function FloatingActionButton({
  onClick,
  label,
  icon: Icon = Plus,
  ariaLabel,
  color = COLORS.accent,
  hoverColor = COLORS.accentHover,
}: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      style={
        {
          backgroundColor: color,
          "--hover-bg": hoverColor,
        } as React.CSSProperties
      }
      className={`fixed bottom-6 right-6 z-50 w-14 h-14 ${RADIUS.lg} text-slate-950 ${SHADOW.fab} ${SHADOW.fabHover} hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center group animate-in fade-in slide-in-from-bottom-4`}
      aria-label={ariaLabel || label}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hoverColor)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = color)}
    >
      <Icon className="h-6 w-6 transition-transform group-hover:rotate-90 duration-300" />
      <span className="absolute right-16 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-lg">
        {label}
      </span>
    </button>
  );
}
