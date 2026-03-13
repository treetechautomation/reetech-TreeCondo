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

function isSundayISO(iso: string) {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.getDay() === 0;
}

  function isHolidayISO(iso: string) {
    const mmdd = iso.slice(5);
    return mmdd === "12-24" || mmdd === "12-25" || mmdd === "12-31" || mmdd === "01-01";
  }

type Props = {
  firestore: Firestore | null;
  condominioId: string | null;
  areaId: string;
  selectedDateStr: string; // YYYY-MM-DD
  onSelectDateStr: (iso: string) => void;

  bloquearDomingo?: boolean;
};

export function CalendarMonth({
  firestore,
  condominioId,
  areaId,
  selectedDateStr,
  onSelectDateStr,
  bloquearDomingo = true,
}: Props) {
  const [monthCursor, setMonthCursor] = React.useState(() => {
    // começa no mês do selectedDateStr
    const [y, m] = selectedDateStr.split("-").map(Number);
    const dt = new Date((y || new Date().getFullYear()), (m ? m - 1 : new Date().getMonth()), 1);
    return dt;
  });

  React.useEffect(() => {
    // se selectedDateStr mudou para outro mês, acompanha
    const [y, m] = selectedDateStr.split("-").map(Number);
    if (!y || !m) return;
    const curY = monthCursor.getFullYear();
    const curM = monthCursor.getMonth() + 1;
    if (curY !== y || curM !== m) {
      setMonthCursor(new Date(y, m - 1, 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateStr]);

  const [loading, setLoading] = React.useState(false);
  const [slotsMap, setSlotsMap] = React.useState<Record<string, { occupied: boolean; filaCount: number }>>({});

  const yyyy = monthCursor.getFullYear();
  const mm0 = monthCursor.getMonth();

  const monthLabel = monthCursor.toLocaleString("pt-BR", { month: "long", year: "numeric" });

  React.useEffect(() => {
    let cancelled = false;

    async function loadSlotsMonth() {
        if (!firestore || !condominioId || !areaId) {
          setSlotsMap({});
          return;
        }

        setLoading(true);
        try {
          const ini = startOfMonthLocal(yyyy, mm0);
          const fim = endOfMonthLocalExclusive(yyyy, mm0);

          const y1 = ini.getFullYear();
          const m1 = String(ini.getMonth() + 1).padStart(2, "0");
          const d1 = String(ini.getDate()).padStart(2, "0");
          const startStr = `${y1}-${m1}-${d1}`;

          const y2 = fim.getFullYear();
          const m2 = String(fim.getMonth() + 1).padStart(2, "0");
          const d2 = String(fim.getDate()).padStart(2, "0");
          const endStr = `${y2}-${m2}-${d2}`;

          const qy = query(
            collection(firestore, "condominios", condominioId, "reservasSlots"),
            where("areaId", "==", areaId),
            where("dateStr", ">=", startStr),
            where("dateStr", "<", endStr)
          );

          const snap = await getDocs(qy);

          const next: Record<string, { occupied: boolean; filaCount: number }> = {};
          snap.forEach((docu) => {
            const d = docu.data() as any;
            const iso = String(d?.dateStr || "");
            if (!iso) return;
            next[iso] = {
              occupied: Boolean(d?.occupied === true),
              filaCount: Number(d?.filaCount || 0) || 0,
            };
          });

          if (!cancelled) setSlotsMap(next);
        } catch (e) {
          console.error("[CalendarMonth] erro ao buscar slots do mês:", e);
          if (!cancelled) setSlotsMap({});
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      loadSlotsMonth();
    return () => { cancelled = true; };
  }, [firestore, condominioId, areaId, yyyy, mm0]);

  // monta grid do mês
  const days = React.useMemo(() => {
    const first = startOfMonthLocal(yyyy, mm0);
    const firstWeekday = (first.getDay() + 6) % 7; // segunda=0 ... domingo=6
    const daysInMonth = new Date(yyyy, mm0 + 1, 0).getDate();

    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];

    // padding antes
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ iso: "", day: 0, inMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(yyyy, mm0, d);
      cells.push({ iso: toISODateLocal(dt), day: d, inMonth: true });
    }

    // completa última semana
    while (cells.length % 7 !== 0) {
      cells.push({ iso: "", day: 0, inMonth: false });
    }

    return cells;
  }, [yyyy, mm0]);

  function prevMonth() {
    setMonthCursor(new Date(yyyy, mm0 - 1, 1));
  }
  function nextMonth() {
    setMonthCursor(new Date(yyyy, mm0 + 1, 1));
  }

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

          const blockedBySunday = Boolean(inMonth && bloquearDomingo && iso && isSundayISO(iso));
            const blockedByHoliday = Boolean(inMonth && iso && isHolidayISO(iso));

            const slot = (inMonth && iso) ? (slotsMap[iso] || null) : null;
            const filaCount = slot ? Number(slot.filaCount || 0) : 0;
            const occupied = slot ? Boolean(slot.occupied === true) : false;

            // regras de cor
            const isRed = Boolean(blockedBySunday || blockedByHoliday || filaCount >= 3);
            // reservado conta como amarelo
              const isQueued = Boolean(!isRed && (occupied || filaCount > 0));
            
            const isGreen = Boolean(!isRed && !isQueued);

            // permite selecionar qualquer dia do mês para consulta;
            // a criação continua sendo validada nas regras/na API
            const disabled = Boolean(!inMonth);

          // classes (verde disponível / vermelho bloqueado / destaque selecionado)
          const stateClass = !inMonth
                ? "opacity-0 pointer-events-none"
                : isRed
                  ? "bg-[#FEE2E2] border-[#EF4444]/50 text-[#B91C1C]"
                  : isQueued
                    ? "bg-[#FFF3B0] border-[#FFDE21]/80 text-[#8A6A00]"
                    : "bg-[#DCFCE7] border-[#34D399]/60 text-[#047857]";

            const selectedClass = selected
            ? "ring-2 ring-primary/30 border-primary"
            : "";

          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (iso) onSelectDateStr(iso);
              }}
              className={cn(
                "h-14 rounded-xl border text-sm font-medium transition hover:opacity-90",
                stateClass,
                selectedClass
              )}
            >
              {inMonth ? c.day : ""}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#34D399]" />
            Disponível
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#FFDE21]" />
            Reservado / com fila
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
            Indisponível
          </span>
        </div>
    </div>
  );
}
