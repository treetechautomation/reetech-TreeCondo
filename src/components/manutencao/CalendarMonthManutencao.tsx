"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  type Firestore,
} from "firebase/firestore";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toISODateLocal(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfMonthLocal(yyyy: number, mm0: number) { return new Date(yyyy, mm0, 1, 0, 0, 0, 0); }
function endOfMonthLocalExclusive(yyyy: number, mm0: number) { return new Date(yyyy, mm0 + 1, 1, 0, 0, 0, 0); }

function toDateMaybe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") {
    try { return new Date(v.seconds * 1000); } catch { return null; }
  }
  return null;
}

export type ManutencaoExec = {
  id: string;
  isoDay: string;
  dataProgramada: Date;
  titulo: string;
  categoria?: string | null;
  status?: string | null;
};

type Props = {
  firestore: Firestore | null;
  condominioId: string | null;
  selectedDateStr: string;
  onSelectDateStr: (iso: string) => void;
  onMonthData?: (data: { byDay: Record<string, ManutencaoExec[]>, countByDay: Record<string, number> }) => void;
};

export function CalendarMonthManutencao({ firestore, condominioId, selectedDateStr, onSelectDateStr, onMonthData }: Props) {
  const onMonthDataRef = React.useRef(onMonthData);
  React.useEffect(() => { onMonthDataRef.current = onMonthData; }, [onMonthData]);

  const [monthCursor, setMonthCursor] = React.useState(() => {
    const [y, m] = selectedDateStr.split("-").map(Number);
    return new Date(y || new Date().getFullYear(), (m ? m - 1 : new Date().getMonth()), 1);
  });

  React.useEffect(() => {
    const [y, m] = selectedDateStr.split("-").map(Number);
    if (!y || !m) return;
    if (monthCursor.getFullYear() !== y || monthCursor.getMonth() + 1 !== m) {
      setMonthCursor(new Date(y, m - 1, 1));
    }
  }, [selectedDateStr, monthCursor]);

  const [loading, setLoading] = React.useState(false);
  const [countByDay, setCountByDay] = React.useState<Record<string, number>>({});

  const yyyy = monthCursor.getFullYear();
  const mm0 = monthCursor.getMonth();
  const monthLabel = monthCursor.toLocaleString("pt-BR", { month: "long", year: "numeric" });

  React.useEffect(() => {
    let cancelled = false;
    async function loadMonth() {
      if (!firestore || !condominioId) {
        setCountByDay({});
        onMonthDataRef.current?.({ byDay: {}, countByDay: {} });
        return;
      }
      setLoading(true);
      try {
        const ini = startOfMonthLocal(yyyy, mm0);
        const fim = endOfMonthLocalExclusive(yyyy, mm0);
        const qy = query(
          collection(firestore, "condominios", condominioId, "manutencaoExecucoes"),
          where("dataProgramada", ">=", Timestamp.fromDate(ini)),
          where("dataProgramada", "<", Timestamp.fromDate(fim))
        );
        const snap = await getDocs(qy);
        const map: Record<string, ManutencaoExec[]> = {};
        snap.forEach((d) => {
          const data = d.data() as any;
          const dt = toDateMaybe(data?.dataProgramada);
          if (!dt) return;
          const isoDay = toISODateLocal(dt);
          map[isoDay] = map[isoDay] || [];
          map[isoDay].push({ id: d.id, isoDay, dataProgramada: dt, titulo: data.titulo, categoria: data.categoria, status: data.status });
        });
        if (!cancelled) {
          const counts = Object.keys(map).reduce((acc, key) => ({ ...acc, [key]: map[key].length }), {});
          setCountByDay(counts);
          onMonthDataRef.current?.({ byDay: map, countByDay: counts });
        }
      } catch (e) {
        console.error("[CalendarMonthManutencao] erro:", e);
        if (!cancelled) {
          setCountByDay({});
          onMonthDataRef.current?.({ byDay: {}, countByDay: {} });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadMonth();
    return () => { cancelled = true; };
  }, [firestore, condominioId, yyyy, mm0]);

  const days = React.useMemo(() => {
    const first = startOfMonthLocal(yyyy, mm0);
    const firstWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(yyyy, mm0 + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ iso: "", day: 0, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ iso: toISODateLocal(new Date(yyyy, mm0, d)), day: d, inMonth: true });
    while (cells.length % 7 !== 0) cells.push({ iso: "", day: 0, inMonth: false });
    return cells;
  }, [yyyy, mm0]);

  const prevMonth = () => setMonthCursor(new Date(yyyy, mm0 - 1, 1));
  const nextMonth = () => setMonthCursor(new Date(yyyy, mm0 + 1, 1));

  return (
    <div className="w-full rounded-2xl border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={prevMonth} className="rounded-xl px-3 py-1 text-sm">‹</button>
        <div className="text-sm font-semibold capitalize">{monthLabel}{loading && "..."}</div>
        <button type="button" onClick={nextMonth} className="rounded-xl px-3 py-1 text-sm">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((c, idx) => {
          const hasEvents = c.inMonth && !!countByDay[c.iso];
          return (
            <button
              key={idx}
              type="button"
              disabled={!c.inMonth}
              onClick={() => c.inMonth && onSelectDateStr(c.iso)}
              className={cn(
                "relative h-9 rounded-xl border text-sm transition",
                !c.inMonth && "opacity-0 pointer-events-none",
                c.inMonth && (selectedDateStr === c.iso ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"),
              )}
            >
              {c.day || ""}
              {hasEvents && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">{Array.from({ length: Math.min(3, countByDay[c.iso]) }).map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/70" />)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
