import { type ExecItem, toDate, normalize, startOfDay } from "./maintenance-utils";

export type { ExecItem };

export interface MonthlyData {
  month: string;
  programadas: number;
  emAndamento: number;
  concluidas: number;
}

export interface CategoryData {
  name: string;
  value: number;
}

export function getLast12Months(): Date[] {
  const months: Date[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d);
  }
  return months;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function computeMonthlyData(items: ExecItem[], months: Date[]): MonthlyData[] {
  return months.map((m) => {
    const start = new Date(m.getFullYear(), m.getMonth(), 1);
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);

    const monthItems = items.filter((item) => {
      const d = toDate(item.dataProgramada);
      return d && d >= start && d < end;
    });

    const programadas = monthItems.filter((i) => normalize(i.status) === "PROGRAMADA").length;
    const emAndamento = monthItems.filter((i) => normalize(i.status) === "EM_ANDAMENTO").length;
    const concluidas = monthItems.filter(
      (i) => normalize(i.status) === "CONCLUIDA" && toDate(i.dataExecutadaEm) && toDate(i.dataExecutadaEm)! >= start && toDate(i.dataExecutadaEm)! < end
    ).length;

    return {
      month: monthLabel(m),
      programadas,
      emAndamento,
      concluidas,
    };
  });
}

export function computeMonthlyVolumes(items: ExecItem[], months: Date[]): { month: string; programadas: number; concluidas: number }[] {
  return months.map((m) => {
    const start = new Date(m.getFullYear(), m.getMonth(), 1);
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);

    const monthItems = items.filter((item) => {
      const d = toDate(item.dataProgramada);
      return d && d >= start && d < end;
    });

    return {
      month: monthLabel(m),
      programadas: monthItems.length,
      concluidas: monthItems.filter((i) => normalize(i.status) === "CONCLUIDA").length,
    };
  });
}

export function computeCategoryData(items: ExecItem[]): CategoryData[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const cat = (item.categoria || "Outros").trim();
    map.set(cat, (map.get(cat) || 0) + 1);
  }
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);

  if (sorted.length <= 5) {
    return sorted.map(([name, value]) => ({ name, value }));
  }

  const top5 = sorted.slice(0, 5).map(([name, value]) => ({ name, value }));
  const outrosValue = sorted.slice(5).reduce((sum, [, v]) => sum + v, 0);
  return [...top5, { name: "Outras", value: outrosValue }];
}

export function computeConformidadeTrend(items: ExecItem[], months: Date[]): { month: string; conformidade: number }[] {
  return months.map((m) => {
    const start = new Date(m.getFullYear(), m.getMonth(), 1);
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);

    const monthItems = items.filter((item) => {
      const d = toDate(item.dataProgramada);
      return d && d >= start && d < end;
    });

    const concluidas = monthItems.filter((i) => normalize(i.status) === "CONCLUIDA").length;
    const total = monthItems.length;
    return {
      month: monthLabel(m),
      conformidade: total > 0 ? Math.round((concluidas / total) * 100) : 100,
    };
  });
}

export function computeStats(items: ExecItem[]): {
  totalExecutadas: number;
  totalPendentes: number;
  topCategoria: string;
  percentualConcluido: number;
} {
  const concluidas = items.filter((i) => normalize(i.status) === "CONCLUIDA").length;
  const pendentes = items.filter((i) => normalize(i.status) !== "CONCLUIDA").length;

  const catMap = new Map<string, number>();
  for (const item of items) {
    const cat = (item.categoria || "Outros").trim();
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  }
  let topCat = "—";
  let topCount = 0;
  for (const [cat, count] of catMap) {
    if (count > topCount) { topCount = count; topCat = cat; }
  }

  return {
    totalExecutadas: concluidas,
    totalPendentes: pendentes,
    topCategoria: topCat,
    percentualConcluido: items.length > 0 ? Math.round((concluidas / items.length) * 100) : 0,
  };
}
