"use client";

import * as React from "react";
import { type LucideIcon, Search, PackageOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BORDER, TEXT } from "./tokens";

/**
 * EmptyState — Standardized empty state display with icon, title, description, and optional CTA.
 *
 * Used across ALL TreeCondo modules for consistency.
 *
 * @example
 * <EmptyState icon={Calendar} title="Nenhuma rotina cadastrada"
 *   description="Cadastre sua primeira rotina para começar."
 *   action={{ label: "Nova Rotina", href: "/manutencao-preventiva/rotinas" }} />
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  size?: "sm" | "md" | "lg";
}

export function EmptyState({ icon: Icon = PackageOpen, title, description, action, size = "md" }: EmptyStateProps) {
  const iconSizes = { sm: "h-6 w-6", md: "h-10 w-10", lg: "h-14 w-14" };
  const padding = { sm: "py-4", md: "py-8", lg: "py-12" };

  return (
    <div className={`text-center ${padding[size]} ${BORDER.dashed} rounded-xl`} role="status">
      <Icon className={`${iconSizes[size]} text-white/20 mx-auto mb-3`} aria-hidden="true" />
      <p className={`${TEXT.base} text-white/40 mb-1`}>{title}</p>
      {description && <p className={`${TEXT.sm} text-white/25 mb-3`}>{description}</p>}
      {action && (
        action.href ? (
          <Button asChild variant="outline" size="sm" className={`${BORDER.medium} text-white/70 hover:bg-white/5 rounded-xl`}>
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={action.onClick} className={`${BORDER.medium} text-white/70 hover:bg-white/5 rounded-xl`}>
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}

/**
 * NoResultsState — Shown when search/filter yields no results. Includes "Limpar filtros" button.
 */
export interface NoResultsStateProps {
  onClear?: () => void;
}

export function NoResultsState({ onClear }: NoResultsStateProps) {
  return (
    <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl" role="status">
      <Search className="h-10 w-10 text-white/20 mx-auto mb-3" aria-hidden="true" />
      <p className="text-sm text-white/40 mb-3">Nenhum resultado corresponde aos filtros selecionados.</p>
      {onClear && (
        <Button variant="outline" size="sm" onClick={onClear} className="border-white/10 text-white/70 hover:bg-white/5 rounded-xl">
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

/**
 * ErrorState — Standardized error display with icon, title, description, and retry action.
 *
 * @example
 * <ErrorState title="Erro ao carregar dados"
 *   description="Não foi possível conectar ao servidor."
 *   onRetry={() => window.location.reload()} />
 */
export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  size?: "sm" | "md";
}

export function ErrorState({ title = "Erro ao carregar", description, onRetry, size = "md" }: ErrorStateProps) {
  const iconSize = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const padding = size === "sm" ? "py-4" : "py-8";

  return (
    <div className={`text-center ${padding} ${BORDER.subtle} rounded-2xl`} role="alert">
      <AlertTriangle className={`${iconSize} text-red-400 mx-auto mb-3`} aria-hidden="true" />
      <h3 className="text-sm font-bold text-white/70 mb-2">{title}</h3>
      {description && <p className="text-xs text-white/30 mb-4">{description}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-bold text-[#00D0E6] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00D0E6]/50 rounded-lg px-3 py-1.5"
          aria-label="Tentar novamente"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
