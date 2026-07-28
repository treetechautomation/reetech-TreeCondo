/**
 * Kit interno compartilhado pelas regras (NÃO é uma regra).
 *
 * Regras não dependem umas das outras; todas podem depender deste kit puro.
 * Aqui vive a implementação CANÔNICA e única de datas — substitui as 4 cópias
 * de isSunday e as 3 cópias de isHoliday identificadas na auditoria D.2.
 */

import type { RuleCode, RulePriority, RuleResult } from "../types";

/** Dia da semana (0=domingo…6=sábado) de uma data civil YYYY-MM-DD, determinístico (meio-dia UTC). */
export function weekdayOfISO(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1, 12, 0, 0, 0)).getUTCDay();
}

/** Meio-dia UTC do dia civil — mesma âncora usada pelo motor congelado (criar/route.ts:55-58). */
export function noonUtcMs(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00.000Z`).getTime();
}

/** Horas entre "agora" e o meio-dia UTC do dia do evento (paridade com criar/route.ts:163). */
export function hoursUntilEvent(dateStr: string, nowMs: number): number {
  return (noonUtcMs(dateStr) - nowMs) / 3_600_000;
}

/** MM-DD de uma data YYYY-MM-DD. */
export function monthDayOf(dateStr: string): string {
  return dateStr.slice(5);
}

/** Normalização de status usada pelo motor congelado (upper/trim). */
export function normStatus(v: unknown): string {
  return String(v ?? "").toUpperCase().trim();
}

export function pass(
  code: RuleCode,
  priority: RulePriority,
  message: string,
  valueUsed?: unknown
): RuleResult {
  return { code, outcome: "PASS", priority, message, valueUsed };
}

export function fail(
  code: RuleCode,
  priority: RulePriority,
  message: string,
  valueUsed?: unknown,
  details?: Record<string, unknown>
): RuleResult {
  return { code, outcome: "FAIL", priority, message, valueUsed, details };
}

export function skip(
  code: RuleCode,
  priority: RulePriority,
  reason: string,
  valueUsed?: unknown
): RuleResult {
  return { code, outcome: "SKIP", priority, message: reason, valueUsed };
}
