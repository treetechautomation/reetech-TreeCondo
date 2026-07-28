/**
 * REGRA: DATA_PASSADA (BLOCKER)
 *
 * Paridade: criar/route.ts:100 (dateStr < todayInSaoPaulo, dia atual PERMITIDO)
 * e reservasPromocaoFila.ts:103.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "DATA_PASSADA" as const;
const PRIORITY = "BLOCKER" as const;

export const pastDateRule: RuleEvaluator = (policy, ctx) => {
  if (policy.policy.booking.allowPastDates) {
    return skip(CODE, PRIORITY, "Política permite datas passadas.", true);
  }
  if (ctx.dateStr < ctx.today) {
    return fail(CODE, PRIORITY, "Não é possível criar reserva para uma data passada.", false, {
      dateStr: ctx.dateStr,
      hoje: ctx.today,
    });
  }
  return pass(CODE, PRIORITY, "Data válida (hoje ou futura).", false);
};
