"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  type ExecItem,
  getStatusConfig,
  isAtrasada,
  normalize,
  formatDateShort,
  KANBAN_COLUMNS,
} from "./maintenance-utils";
import { ChevronRight } from "lucide-react";

interface MaintenanceKanbanViewProps {
  items: ExecItem[];
  loading: boolean;
}

export default function MaintenanceKanbanView({ items, loading }: MaintenanceKanbanViewProps) {
  const grouped = React.useMemo(() => {
    const map: Record<string, ExecItem[]> = {};
    for (const item of items) {
      const status = normalize(item.status);
      const known = KANBAN_COLUMNS.some((c) => c.status === status);
      const key = known ? status : "_unknown";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [items]);

  const columns = React.useMemo(() => [
    ...KANBAN_COLUMNS.map((c) => ({ ...c, isDefault: false })),
    ...(grouped._unknown && grouped._unknown.length > 0
      ? [{ status: "_unknown" as string, label: "Desconhecido", isDefault: true }]
      : []),
  ], [grouped._unknown]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando kanban">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-8 w-24 bg-white/10 rounded-lg" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-20 w-full bg-white/10 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" role="list" aria-label="Kanban de manutenções">
      {columns.map((col) => {
        const colItems = grouped[col.status] || [];
        const cfg = getStatusConfig(col.status);
        const Icon = cfg.icon;

        return (
          <div key={col.status} className="space-y-3" role="listitem" aria-label={`Coluna ${col.label}: ${colItems.length} itens`}>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                <h4 className="text-sm font-bold text-white/60">{col.label}</h4>
              </div>
              <span className="text-[11px] font-bold text-white/30 bg-white/5 px-2 py-0.5 rounded-full" aria-label={`${colItems.length} itens`}>
                {colItems.length}
              </span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {colItems.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-white/[0.06] rounded-xl" role="status">
                  <p className="text-[11px] text-white/20">Vazio</p>
                </div>
              ) : (
                colItems.map((item) => {
                  const atrasada = isAtrasada(item);

                  return (
                    <Link
                      key={item.id}
                      href={`/manutencao-preventiva/rotinas/${item.rotinaId || item.id}`}
                      className={`block p-3 rounded-xl border transition-all duration-200 group ${
                        atrasada
                          ? "border-red-500/20 bg-red-500/[0.03] hover:border-red-500/30 hover:bg-red-500/[0.06]"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-[#00D0E6]/15 hover:bg-white/[0.04]"
                      }`}
                      aria-label={`${item.titulo || "Manutenção"} — ${formatDateShort(item.dataProgramada)} — ${cfg.label}${atrasada ? " — Atrasada" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-[#00D0E6] transition-colors">
                            {item.titulo || "Sem título"}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-white/40">{formatDateShort(item.dataProgramada)}</span>
                            {item.categoria && (
                              <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
                                {item.categoria}
                              </span>
                            )}
                          </div>
                          {item.fornecedorNome && (
                            <p className="text-[10px] text-white/25 mt-1 truncate">{item.fornecedorNome}</p>
                          )}
                          {atrasada && (
                            <Badge className="mt-2 text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 border-red-500/20">
                              Atrasada
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-white/10 group-hover:text-[#00D0E6] transition-colors mt-1 shrink-0" aria-hidden="true" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
