"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, Timestamp, orderBy, Firestore } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MaintenanceListView from "./MaintenanceListView";
import MaintenanceCalendarView from "./MaintenanceCalendarView";
import MaintenanceKanbanView from "./MaintenanceKanbanView";
import {
  type ExecItem,
  type ViewMode,
  VIEW_MODES,
} from "./maintenance-utils";
import { Calendar, List, Columns, AlertTriangle } from "lucide-react";

const VIEW_ICONS: Record<ViewMode, React.ComponentType<any>> = {
  list: List,
  calendar: Calendar,
  kanban: Columns,
};

interface MaintenanceScheduleProps {
  firestore: Firestore | null;
  condominioId: string | null;
}

export default function MaintenanceSchedule({ firestore, condominioId }: MaintenanceScheduleProps) {
  const [items, setItems] = React.useState<ExecItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("manutencao-view") as ViewMode) || "list";
    }
    return "list";
  });

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("manutencao-view", view);
    }
  }, [view]);

  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const execRef = collection(firestore, "condominios", condominioId, "manutencaoExecucoes");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const q = query(
      execRef,
      where("dataProgramada", ">=", Timestamp.fromDate(thirtyDaysAgo)),
      orderBy("dataProgramada", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ExecItem[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        setItems(list);
        setLoading(false);
      },
      (err) => {
        console.error("[MaintenanceSchedule] erro:", err);
        setError(String(err?.message || "Erro ao carregar dados"));
        setLoading(false);
      }
    );

    return unsub;
  }, [firestore, condominioId]);

  if (error) {
    return (
      <Card className="border-white/[0.06] bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 animate-in fade-in duration-300" role="alert">
        <div className="text-center py-8">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-sm font-bold text-white/70 mb-2">Erro ao carregar o cronograma</h3>
          <p className="text-xs text-white/30 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-bold text-[#00D0E6] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00D0E6]/50 rounded-lg px-3 py-1.5"
            aria-label="Tentar novamente carregar os dados"
          >
            Tentar novamente
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-white/[0.06] bg-slate-900/60 backdrop-blur-xl rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-white/[0.01] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Cronograma de Manutenções</h3>
          <p className="text-[11px] text-white/30 mt-0.5">Acompanhe, filtre e gerencie as execuções programadas</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {VIEW_MODES.map((m) => {
            const Icon = VIEW_ICONS[m.key];
            return (
              <button
                key={m.key}
                onClick={() => setView(m.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                  view === m.key
                    ? "bg-[#00D0E6]/15 text-[#00D0E6]"
                    : "text-white/40 hover:text-white/70"
                }`}
                aria-label={`Visualização ${m.label}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {view === "list" && <MaintenanceListView items={items} loading={loading} />}
        {view === "calendar" && <MaintenanceCalendarView firestore={firestore} condominioId={condominioId} items={items} loading={loading} />}
        {view === "kanban" && <MaintenanceKanbanView items={items} loading={loading} />}
      </div>
    </Card>
  );
}
