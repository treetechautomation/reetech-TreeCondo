"use client";

import * as React from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  type Firestore,
} from "firebase/firestore";

// helpers de data (por dia local)
function startOfMonthLocal(y: number, m0: number) {
  return new Date(y, m0, 1, 0, 0, 0, 0);
}
function endOfMonthLocalExclusive(y: number, m0: number) {
  return new Date(y, m0 + 1, 1, 0, 0, 0, 0);
}
function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toDateMaybe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  return null;
}

type ReuniaoExec = {
  id: string;
  isoDay: string;
  dataInicio: Date;
  titulo?: string | null;
  tipo?: string | null;
  status?: string | null;
};

type Props = {
  firestore: Firestore | null;
  condominioId: string | null;
  selectedDateStr: string; // YYYY-MM-DD
  onSelectDateStr: (iso: string) => void;
  onMonthData?: (data: { byDay: Record<string, ReuniaoExec[]>; countByDay: Record<string, number> }) => void;
};

export function CalendarMonthReunioes({
  firestore,
  condominioId,
  selectedDateStr,
  onSelectDateStr,
  onMonthData,
}: Props) {
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
          collection(firestore, "condominios", condominioId, "reunioes"),
          where("dataInicio", ">=", Timestamp.fromDate(ini)),
          where("dataInicio", "<", Timestamp.fromDate(fim))
        );

        const snap = await getDocs(qy);
        const map: Record<string, ReuniaoExec[]> = {};

        snap.forEach((d) => {
          const data = d.data() as any;
          const dt = toDateMaybe(data?.dataInicio);
          if (!dt) return;

          const isoDay = toISODateLocal(dt);
          map[isoDay] = map[isoDay] || [];
          map[isoDay].push({
            id: d.id,
            isoDay,
            dataInicio: dt,
            titulo: data.titulo,
            tipo: data.tipo,
            status: data.status,
          });
        });

        if (!cancelled) {
          const counts = Object.keys(map).reduce((acc, key) => ({ ...acc, [key]: map[key].length }), {});
          setCountByDay(counts);
          onMonthDataRef.current?.({ byDay: map, countByDay: counts });
        }
      } catch (e) {
        console.error("[CalendarMonthReunioes] erro:", e);
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
    const firstWeekday = (first.getDay() + 6) % 7; // seg=0
    const daysInMonth = new Date(yyyy, mm0 + 1, 0).getDate();

    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ iso: "", day: 0, inMonth: false });

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(yyyy, mm0, d, 0, 0, 0, 0);
      cells.push({ iso: toISODateLocal(dt), day: d, inMonth: true });
    }

    while (cells.length % 7 !== 0) cells.push({ iso: "", day: 0, inMonth: false });
    return cells;
  }, [yyyy, mm0]);

  function navMonth(delta: number) {
    const next = new Date(yyyy, mm0 + delta, 1);
    const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    onSelectDateStr(iso);
  }

  const selectedIso = selectedDateStr;

  return (
    <div className="rounded-2xl border bg-white/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <button className="px-2 py-1 rounded-md hover:bg-black/5" onClick={() => navMonth(-1)} aria-label="Anterior">‹</button>
        <div className="text-sm font-semibold capitalize">{monthLabel}</div>
        <button className="px-2 py-1 rounded-md hover:bg-black/5" onClick={() => navMonth(1)} aria-label="Próximo">›</button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground mb-2">
        {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((w) => (
          <div key={w} className="text-center">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((c, idx) => {
          const isSelected = c.inMonth && c.iso === selectedIso;
          const count = c.inMonth ? (countByDay[c.iso] || 0) : 0;

          return (
            <button
              key={idx}
              disabled={!c.inMonth}
              onClick={() => c.iso && onSelectDateStr(c.iso)}
              className={[
                "h-12 rounded-xl border text-sm relative",
                c.inMonth ? "bg-white/50 hover:bg-white/70" : "opacity-0 cursor-default",
                isSelected ? "ring-2 ring-black/40 bg-white" : "",
              ].join(" ")}
            >
              <div className="text-center">{c.day || ""}</div>

              {count > 0 && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-1 flex gap-1 items-center">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-black/40" />
                  ))}
                  {count > 3 && <span className="text-[10px] text-black/60">+{count - 3}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {loading && <div className="mt-2 text-xs text-muted-foreground">Carregando mês...</div>}
    </div>
  );
}
