/**
 * ACCESS.5 — HELPERS DE FORMATAÇÃO (CLIENT-SAFE, PUROS).
 * Sem imports de módulos server-only — apenas string/Date.
 */

const VISIT_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatVisitDate(visitDate: string): string {
  const m = visitDate.match(VISIT_DATE_RE);
  if (!m) return visitDate;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

export function formatTimeOfDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function toIsoOrNull(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
