/**
 * REGRA: DIA_SEMANA_BLOQUEADO (VALIDATION)
 *
 * Paridade: criar/route.ts:105 e reservasPromocaoFila.ts:111 (domingo sempre
 * bloqueado no servidor). Implementação canônica única de dia da semana —
 * substitui as 4 cópias divergentes de isSunday (UTC vs local) da auditoria D.2.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, weekdayOfISO } from "./_shared";

const CODE = "DIA_SEMANA_BLOQUEADO" as const;
const PRIORITY = "VALIDATION" as const;

const WEEKDAY_LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const weekdayRule: RuleEvaluator = (policy, ctx) => {
  const blocked = policy.blockedWeekdaySet;
  const weekday = weekdayOfISO(ctx.dateStr);
  if (blocked.has(weekday)) {
    return fail(
      CODE,
      PRIORITY,
      weekday === 0
        ? "❌ Não é permitido fazer reservas aos domingos."
        : `Não é permitido fazer reservas às(aos) ${WEEKDAY_LABEL[weekday]}s.`,
      policy.policy.weekdays.blockedWeekdays,
      { weekday }
    );
  }
  return pass(CODE, PRIORITY, "Dia da semana permitido.", policy.policy.weekdays.blockedWeekdays);
};
