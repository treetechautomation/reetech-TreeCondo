/**
 * D.11.5 — REGRA: CHECKIN_OBRIGATORIO (VALIDATION).
 *
 * Art. 25: check-in obrigatório na portaria. SKIPa se não configurado.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "CHECKIN_OBRIGATORIO" as const;
const PRIORITY = "VALIDATION" as const;

export const checkinRequiredRule: RuleEvaluator = (_policy, ctx) => {
  const required = _policy.policy.checkin.required;
  if (!required) {
    return skip(CODE, PRIORITY, "Check-in não é obrigatório.", false);
  }
  if (ctx.checkinCompleted !== true) {
    return fail(CODE, PRIORITY, "Check-in obrigatório não realizado na portaria.", null, {
      reserva: ctx.reserva?.status ?? "desconhecida",
    });
  }
  return pass(CODE, PRIORITY, "Check-in realizado.", true);
};
