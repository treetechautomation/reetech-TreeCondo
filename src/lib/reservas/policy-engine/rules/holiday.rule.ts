/**
 * REGRA: FERIADO_BLOQUEADO (VALIDATION)
 *
 * Paridade: criar/route.ts:37-41/106, reservasPromocaoFila.ts:14-17/119,
 * CalendarMonth.tsx:39-42 — datas fixas 12-24, 12-25, 12-31, 01-01.
 *
 * Extensões previstas em D.2 (desligadas na política default para manter o
 * comportamento homologado): feriados móveis via Páscoa (Carnaval, Sexta
 * Santa, Corpus Christi) e datas custom por condomínio.
 */

import type { RuleEvaluator } from "../types";
import { fail, monthDayOf, pass, skip } from "./_shared";

const CODE = "FERIADO_BLOQUEADO" as const;
const PRIORITY = "VALIDATION" as const;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) — [mês 1-12, dia]. */
export function easterOf(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

function isoOffsetFromEaster(year: number, offsetDays: number): string {
  const [m, d] = easterOf(year);
  const t = Date.UTC(year, m - 1, d, 12) + offsetDays * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Feriados móveis nacionais do ano: Carnaval (seg/ter), Sexta Santa, Corpus Christi. */
export function movableHolidaysOf(year: number): string[] {
  return [
    isoOffsetFromEaster(year, -48), // segunda de Carnaval
    isoOffsetFromEaster(year, -47), // terça de Carnaval
    isoOffsetFromEaster(year, -2), // Sexta-feira Santa
    isoOffsetFromEaster(year, 60), // Corpus Christi
  ];
}

export const holidayRule: RuleEvaluator = (policy, ctx) => {
  const h = policy.policy.holidays;
  const mmdd = monthDayOf(ctx.dateStr);
  const year = Number(ctx.dateStr.slice(0, 4));

  const isFixed = policy.blockedFixedDateSet.has(mmdd);
  const isCustom =
    policy.blockedCustomFullDateSet.has(ctx.dateStr) || policy.blockedCustomMonthDaySet.has(mmdd);
  const isMovable = h.includeMovable && movableHolidaysOf(year).includes(ctx.dateStr);

  const isHoliday = isFixed || isCustom || isMovable;

  if (!isHoliday) {
    return pass(CODE, PRIORITY, "Data não é feriado bloqueado.", h.fixedDates);
  }
  if (h.mode !== "BLOCK" && !isCustom) {
    return skip(CODE, PRIORITY, `Feriado com modo ${h.mode} — não bloqueia.`, h.mode);
  }
  return fail(
    CODE,
    PRIORITY,
    "❌ Não é permitido fazer reservas nesta data (feriado).",
    h.fixedDates,
    { dateStr: ctx.dateStr, fixo: isFixed, movel: isMovable, custom: isCustom }
  );
};
