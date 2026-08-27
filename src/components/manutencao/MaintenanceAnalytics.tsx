"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, Timestamp, orderBy, Firestore } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaintenanceCharts from "./MaintenanceCharts";
import { type ExecItem, computeStats } from "./maintenanceAnalyticsUtils";
import { BarChart3, CheckCircle, Clock, TrendingUp } from "lucide-react";

interface MaintenanceAnalyticsProps {
  firestore: Firestore | null;
  condominioId: string | null;
}

const PERIOD_OPTIONS = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
];

function StatCard({ label, value, icon: Icon, accentClass, accentBg }: {
  label: string; value: string | number; icon: React.ComponentType<any>; accentClass: string; accentBg: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className={`${accentBg} p-2 rounded-lg shrink-0`}>
        <Icon className={`h-4 w-4 ${accentClass}`} />
      </div>
      <div>
        <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{label}</p>
        <p className="text-lg font-black text-white">{value}</p>
      </div>
    </div>
  );
}

export default function MaintenanceAnalytics({ firestore, condominioId }: MaintenanceAnalyticsProps) {
  const [items, setItems] = React.useState<ExecItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [months, setMonths] = React.useState<number>(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem("manutencao-analytics-months") || "6", 10);
    }
    return 6;
  });

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("manutencao-analytics-months", String(months));
    }
  }, [months]);

  React.useEffect(() => {
    if (!firestore || !condominioId) { setLoading(false); return; }

    setLoading(true);
    const execRef = collection(firestore, "condominios", condominioId, "manutencaoExecucoes");
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    const q = query(
      execRef,
      where("dataProgramada", ">=", Timestamp.fromDate(startDate)),
      orderBy("dataProgramada", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: ExecItem[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setItems(list);
      setLoading(false);
    });

    return unsub;
  }, [firestore, condominioId]);

  // Filter items to the selected month range
  const filtered = React.useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStart = new Date(cutoff.getFullYear(), cutoff.getMonth(), 1);
    return items.filter((item) => {
      const d = item.dataProgramada?.toDate?.() ?? (item.dataProgramada instanceof Date ? item.dataProgramada : null);
      return d && d >= cutoffStart;
    });
  }, [items, months]);

  const stats = React.useMemo(() => computeStats(filtered), [filtered]);

  return (
    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500" aria-label="Análise de manutenções">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#00D0E6]" aria-hidden="true" />
            Visão Analítica
          </h3>
          <p className="text-[11px] text-white/30 mt-0.5">
            Acompanhe o desempenho das manutenções do condomínio.
          </p>
        </div>
        <Select value={String(months)} onValueChange={(v) => setMonths(parseInt(v, 10))} aria-label="Período de análise">
          <SelectTrigger className="w-[130px] h-8 bg-slate-900/60 border-white/10 text-white/70 text-xs rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-white/10">
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Indicadores analíticos">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-white/10 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard label="Total executadas" value={stats.totalExecutadas} icon={CheckCircle} accentClass="text-emerald-500" accentBg="bg-emerald-500/10" />
            <StatCard label="Total pendentes" value={stats.totalPendentes} icon={Clock} accentClass="text-amber-500" accentBg="bg-amber-500/10" />
            <StatCard label="Top categoria" value={stats.topCategoria} icon={TrendingUp} accentClass="text-violet-500" accentBg="bg-violet-500/10" />
            <StatCard label="% Concluído" value={`${stats.percentualConcluido}%`} icon={BarChart3} accentClass={stats.percentualConcluido >= 80 ? "text-emerald-500" : "text-amber-500"} accentBg={stats.percentualConcluido >= 80 ? "bg-emerald-500/10" : "bg-amber-500/10"} />
          </>
        )}
      </div>

      {/* Charts */}
      <MaintenanceCharts items={filtered} months={months} loading={loading} />
    </section>
  );
}
