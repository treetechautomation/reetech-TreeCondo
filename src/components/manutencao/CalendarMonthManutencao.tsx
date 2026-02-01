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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function startOfMonthLocal(yyyy: number, mm0: number) {
  return new Date(yyyy, mm0, 1, 0, 0, 0, 0);
}
function endOfMonthLocalExclusive(yyyy: number, mm0: number) {
  return new Date(yyyy, mm0 + 1, 1, 0, 0, 0, 0);
}

function toDateMaybe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  // Timestamp-like
  if (typeof v?.seconds === "number") {
    try {
      return new Date(v.seconds * 1000);
    } catch {
      return null;
    }
  }
  return null;
}

export type ManutencaoExec = {
  id: string;
  isoDay: string; // YYYY-MM-DD (local)
  titulo: string;
  categoria?: string | null;
  fornecedorNome?: string | null;
  status?: string | null;
};

type Props = {
  firestore: Firestore | null;
  condominioId: string | null;

  selectedDateStr: string; // YYYY-MM-DD
  onSelectDateStr: (iso: string) => void;

  // retorno de dados para a página listar
  onMonthData?: (data: {
    byDay: Record<string, ManutencaoExec[]>;
    countByDay: Record<string, number>;
  }) => void;
};

export function CalendarMonthManutencao({
  firestore,
  condominioId,
  selectedDateStr,
  onSelectDateStr,
  onMonthData,
}: Props) {
  const onMonthDataRef = React.useRef<Props["onMonthData"]>(onMonthData);

  React.useEffect(() => {
    onMonthDataRef.current = onMonthData;
  }, [onMonthData]);

  const [monthCursor, setMonthCursor] = React.useState(() => {
    const [y, m] = selectedDateStr.split("-").map(Number);
    const dt = new Date(
      y || new Date().getFullYear(),
      (m ? m - 1 : new Date().getMonth()),
      1
    );
    return dt;
  });

  React.useEffect(() => {
    const [y, m] = selectedDateStr.split("-").map(Number);
    if (!y || !m) return;
    const curY = monthCursor.getFullYear();
    const curM = monthCursor.getMonth() + 1;
    if (curY !== y || curM !== m) setMonthCursor(new Date(y, m - 1, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateStr]);

  const [loading, setLoading] = React.useState(false);
  const [byDay, setByDay] = React.useState<Record<string, ManutencaoExec[]>>({});
  const [countByDay, setCountByDay] = React.useState<Record<string, number>>({});

  const yyyy = monthCursor.getFullYear();
  const mm0 = monthCursor.getMonth();
  const monthLabel = monthCursor.toLocaleString("pt-BR", { month: "long", year: "numeric" });

  React.useEffect(() => {
    let cancelled = false;

    async function loadMonth() {
      if (!firestore || !condominioId) {
        setByDay({});
        setCountByDay({});
        onMonthDataRef.current?.({ byDay: {}, countByDay: {} });
        return;
      }

      setLoading(true);
      try {
        const ini = startOfMonthLocal(yyyy, mm0);
        const fim = endOfMonthLocalExclusive(yyyy, mm0);

        // coleção sugerida pelo seu fluxo (e já apareceu erro de index pra ela antes)
        const col = collection(firestore, "condominios", condominioId, "manutencaoExecucoes");

        // tentamos filtrar por um campo de data mais provável: "data"
        // Se no seu schema estiver outro nome (dataAgendada/dataPrevista/dataExecucao),
        // a listagem ainda funciona se existir "data". Se não existir, ajuste depois.
        const qy = query(
          col,
          where("dataProgramada", ">=", Timestamp.fromDate(ini)),
          where("dataProgramada", "<", Timestamp.fromDate(fim))
        );

        const snap = await getDocs(qy);

        const map: Record<string, ManutencaoExec[]> = {};
        const counts: Record<string, number> = {};

        snap.forEach((d) => {
          const data = d.data() as any;

          const dt =
              toDateMaybe(data?.dataProgramada) ||
              toDateMaybe(data?.data) ||
              toDateMaybe(data?.dataAgendada) ||
              toDateMaybe(data?.dataPrevista) ||
              toDateMaybe(data?.dataExecucao) ||
              null;

          if (!dt) return;

          const isoDay = toISODateLocal(dt);

          const titulo =
            String(data?.titulo ?? data?.nome ?? data?.descricao ?? "Manutenção");

          const categoria = data?.categoria ?? data?.tipo ?? data?.category ?? null;
          const fornecedorNome =
            data?.fornecedorNome ?? data?.fornecedor ?? data?.empresa ?? null;

          const status = data?.status ?? null;

          const item: ManutencaoExec = {
            id: d.id,
            isoDay,
            titulo,
            categoria: categoria ? String(categoria) : null,
            fornecedorNome: fornecedorNome ? String(fornecedorNome) : null,
            status: status ? String(status) : null,
          };

          map[isoDay] = map[isoDay] || [];
          map[isoDay].push(item);

          counts[isoDay] = (counts[isoDay] || 0) + 1;
        });

        if (!cancelled) {
          setByDay(map);
          setCountByDay(counts);
          onMonthDataRef.current?.({ byDay: map, countByDay: counts });
        }
      } catch (e) {
        console.error("[CalendarMonthManutencao] erro ao buscar execuções do mês:", e);
        if (!cancelled) {
          setByDay({});
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
    const firstWeekday = (first.getDay() + 6) % 7; // segunda=0 ... domingo=6
    const daysInMonth = new Date(yyyy, mm0 + 1, 0).getDate();

    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];

    for (let i = 0; i < firstWeekday; i++) cells.push({ iso: "", day: 0, inMonth: false });

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(yyyy, mm0, d);
      cells.push({ iso: toISODateLocal(dt), day: d, inMonth: true });
    }

    while (cells.length % 7 !== 0) cells.push({ iso: "", day: 0, inMonth: false });
    return cells;
  }, [yyyy, mm0]);

  function prevMonth() { setMonthCursor(new Date(yyyy, mm0 - 1, 1)); }
  function nextMonth() { setMonthCursor(new Date(yyyy, mm0 + 1, 1)); }

  return (
    <div className="w-full rounded-2xl border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-xl border border-accent bg-accent px-3 py-1 text-sm text-accent-foreground hover:bg-accent/90"
          aria-label="Mês anterior"
        >
          ‹
        </button>

        <div className="text-sm font-semibold capitalize">
          {monthLabel}
          {loading ? <span className="ml-2 text-xs text-muted-foreground">(carregando...)</span> : null}
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="rounded-xl border border-accent bg-accent px-3 py-1 text-sm text-accent-foreground hover:bg-accent/90"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((c, idx) => {
          const inMonth = c.inMonth;
          const iso = c.iso;
          const selected = inMonth && iso === selectedDateStr;

          const hasEvents = Boolean(inMonth && iso && (countByDay[iso] || 0) > 0);

          const baseClass = !inMonth
            ? "opacity-0 pointer-events-none"
            : "bg-muted/10 border-muted/30 text-foreground hover:bg-muted/20";

          const selectedClass = selected ? "ring-2 ring-primary/30 border-primary" : "";

          return (
            <button
              key={idx}
              type="button"
              disabled={!inMonth}
              onClick={() => { if (iso) onSelectDateStr(iso); }}
              className={cn(
                "relative h-9 rounded-xl border text-sm font-medium transition",
                baseClass,
                selectedClass
              )}
            >
              {inMonth ? c.day : ""}

              {hasEvents ? (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                  {/* até 3 bolinhas, igual indicador visual */}
                  {Array.from({ length: Math.min(3, countByDay[iso] || 0) }).map((_, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-primary/70" />
          Dia com manutenção
        </span>
      </div>
    </div>
  );
}
