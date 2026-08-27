"use client";

import * as React from "react";
import { CalendarMonthManutencao, type ManutencaoExec } from "@/components/manutencao/CalendarMonthManutencao";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Firestore } from "firebase/firestore";
import {
  type ExecItem,
  getStatusConfig,
  isAtrasada,
  normalize,
  formatDateBR,
  formatDateShort,
} from "./maintenance-utils";
import { AlertaBadge, CategoriaBadge } from "@/components/ui/tc-badges";
import { Calendar, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function toISODateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface MaintenanceCalendarViewProps {
  firestore: Firestore | null;
  condominioId: string | null;
  items: ExecItem[];
  loading: boolean;
}

export default function MaintenanceCalendarView({ firestore, condominioId, items, loading }: MaintenanceCalendarViewProps) {
  const [selectedDateStr, setSelectedDateStr] = React.useState(() => toISODateLocal(new Date()));
  const [monthByDay, setMonthByDay] = React.useState<Record<string, ManutencaoExec[]>>({});

  const filteredForDay = React.useMemo(() => {
    return items.filter((item) => {
      const d = item.dataProgramada?.toDate?.() ?? (item.dataProgramada instanceof Date ? item.dataProgramada : null);
      if (!d) return false;
      return toISODateLocal(d) === selectedDateStr;
    });
  }, [items, selectedDateStr]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1">
        <CalendarMonthManutencao
          firestore={firestore}
          condominioId={condominioId}
          selectedDateStr={selectedDateStr}
          onSelectDateStr={setSelectedDateStr}
          onMonthData={({ byDay }) => setMonthByDay(byDay || {})}
        />
      </div>
      <div className="w-full md:w-1/3">
        <h4 className="font-semibold mb-3 tracking-wide text-white/90 text-sm">
          <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">Manutenções do dia</span>
          <span className="ml-2 text-[11px] bg-white/10 px-2 py-0.5 rounded-full text-white/50">{selectedDateStr}</span>
        </h4>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-white/10 rounded-xl" />
            ))}
          </div>
        ) : filteredForDay.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
            <Calendar className="h-6 w-6 text-white/20 mx-auto mb-2" />
            <p className="text-xs text-white/40">Nenhuma manutenção para este dia.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredForDay.map((item) => {
              const atrasada = isAtrasada(item);
              const cfg = atrasada ? getStatusConfig("ATRASADA") : getStatusConfig(item.status);
              const StatusIcon = cfg.icon;

              return (
                <Link
                  key={item.id}
                  href={`/manutencao-preventiva/rotinas/${item.rotinaId || item.id}`}
                  className="block p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-white truncate group-hover:text-[#00D0E6] transition-colors">
                        {item.titulo || "Sem título"}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {item.categoria && <CategoriaBadge categoria={item.categoria} />}
                        <Badge className={`text-[10px] px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          <StatusIcon className="h-3 w-3 mr-1 inline" />
                          {cfg.label}
                        </Badge>
                      </div>
                      {item.fornecedorNome && (
                        <p className="text-[11px] text-white/30 mt-1">{item.fornecedorNome}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-[#00D0E6] transition-colors mt-1 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
