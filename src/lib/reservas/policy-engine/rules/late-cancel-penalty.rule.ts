/**
 * D.11.5 — REGRA: CANCELAMENTO_MULTA (VALIDATION).
 *
 * Art. 14/32 do regulamento: multa financeira por cancelamento fora da janela.
 * SKIPa se lateCancelFeeCentavos for null — retrocompatível.
 */

import type { RuleEvaluator } from "../types";
import { fail, hoursUntilEvent, pass, skip } from "./_shared";

const CODE = "CANCELAMENTO_MULTA" as const;
const PRIORITY = "VALIDATION" as const;

export const lateCancelPenaltyRule: RuleEvaluator = (_policy, ctx) => {
  const fee = _policy.policy.financial.lateCancelFeeCentavos;
  if (fee == null || fee <= 0) {
    return skip(CODE, PRIORITY, "Sem multa de cancelamento configurada.", null);
  }
  const hrs = hoursUntilEvent(ctx.dateStr, ctx.nowMs);
  const minHrs = _policy.policy.cancellation.minHoursBeforeEvent;
  if (hrs >= minHrs) {
    return pass(CODE, PRIORITY, "Cancelamento dentro da janela — sem multa.", fee);
  }
  return fail(CODE, PRIORITY, `Cancelamento tardio: multa de R$${(fee / 100).toFixed(2)}.`, fee, {
    horasRestantes: Math.floor(hrs),
    janelaHoras: minHrs,
  });
};
