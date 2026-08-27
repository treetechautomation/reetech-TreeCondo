"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";
import { CARD_PREMIUM_STYLE, TEXT, KPI_ACCENTS, type KpiAccentKey } from "./tokens";

/**
 * KpiCard — Metric card with icon, value, optional trend indicator, and loading state.
 *
 * Used across: Manutenção Preventiva, Reservas Dashboard, Portaria, Painel, TreeMídia.
 *
 * @example
 * <KpiCard label="Atrasadas" value={5} icon={AlertTriangle} accent="red"
 *   trend={{ direction: "down", label: "3 pendentes", good: false }}
 *   loading={false} />
 */
export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: KpiAccentKey;
  accentClass?: string;
  accentBg?: string;
  trend?: { direction: "up" | "down" | "neutral"; label: string; good: boolean };
  loading?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = "ciano",
  accentClass,
  accentBg,
  trend,
  loading,
  className = "",
}: KpiCardProps) {
  const acc = KPI_ACCENTS[accent];
  const cls = accentClass ?? acc.accentClass;
  const bg = accentBg ?? acc.accentBg;

  return (
    <Card className={`${CARD_PREMIUM_STYLE} p-5 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <span className="text-[11px] text-white/40 uppercase font-bold tracking-wider">
            {label}
          </span>
          {loading ? (
            <Skeleton className="h-8 w-16 bg-white/10" />
          ) : (
            <div className={`${TEXT.xl} font-black text-white`}>{value}</div>
          )}
          {trend && !loading && (
            <div className="flex items-center gap-1">
              {trend.direction === "up" && (
                <ArrowUp className={`h-3 w-3 ${trend.good ? "text-emerald-400" : "text-red-400"}`} />
              )}
              {trend.direction === "down" && (
                <ArrowDown className={`h-3 w-3 ${trend.good ? "text-emerald-400" : "text-red-400"}`} />
              )}
              <span className={`text-[10px] font-semibold ${trend.good ? "text-emerald-400" : "text-red-400"}`}>
                {trend.label}
              </span>
              <span className="text-[10px] text-white/30">vs mês anterior</span>
            </div>
          )}
        </div>
        <div className={`${bg} p-2.5 rounded-xl`}>
          <Icon className={`h-5 w-5 ${cls}`} />
        </div>
      </div>
    </Card>
  );
}

/**
 * StatCard — Compact stat with icon, label, and value. Used in analytics sections.
 *
 * @example
 * <StatCard label="Total executadas" value={42} icon={CheckCircle} accent="emerald" />
 */
export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: KpiAccentKey;
  accentClass?: string;
  accentBg?: string;
}

export function StatCard({ label, value, icon: Icon, accent = "ciano", accentClass, accentBg }: StatCardProps) {
  const acc = KPI_ACCENTS[accent];
  const cls = accentClass ?? acc.accentClass;
  const bg = accentBg ?? acc.accentBg;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className={`${bg} p-2 rounded-lg shrink-0`}>
        <Icon className={`h-4 w-4 ${cls}`} />
      </div>
      <div>
        <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{label}</p>
        <p className="text-lg font-black text-white">{value}</p>
      </div>
    </div>
  );
}
