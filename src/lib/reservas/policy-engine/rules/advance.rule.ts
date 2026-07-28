/**
 * REGRA: ANTECEDENCIA_MIN / ANTECEDENCIA_MAX (VALIDATION)
 *
 * Hoje o motor congelado NÃO impõe antecedência mínima em horas nem horizonte
 * máximo (apenas bloqueia data passada). A política default preserva isso
 * (minAdvanceHours=0, maxAdvanceDays=null) ⇒ regra sempre PASS/SKIP na v0.
 * Fica pronta para o regulamento completo (D.6).
 */

import type { RuleEvaluator } from "../types";
import { fail, hoursUntilEvent, pass, skip } from "./_shared";

const PRIORITY = "VALIDATION" as const;

export const minAdvanceRule: RuleEvaluator = (policy, ctx) => {
  const min = policy.policy.booking.minAdvanceHours;
  if (!min || min <= 0) {
    return skip("ANTECEDENCIA_MIN", PRIORITY, "Sem antecedência mínima configurada.", 0);
  }
  const hrs = hoursUntilEvent(ctx.dateStr, ctx.nowMs);
  if (hrs < min) {
    return fail(
      "ANTECEDENCIA_MIN",
      PRIORITY,
      `Reserva exige antecedência mínima de ${min}h.`,
      min,
      { horasAteEvento: Math.floor(hrs) }
    );
  }
  return pass("ANTECEDENCIA_MIN", PRIORITY, "Antecedência mínima atendida.", min);
};

export const maxAdvanceRule: RuleEvaluator = (policy, ctx) => {
  const maxDays = policy.policy.booking.maxAdvanceDays;
  if (maxDays == null) {
    return skip("ANTECEDENCIA_MAX", PRIORITY, "Sem horizonte máximo configurado.", null);
  }
  const hrs = hoursUntilEvent(ctx.dateStr, ctx.nowMs);
  if (hrs > maxDays * 24) {
    return fail(
      "ANTECEDENCIA_MAX",
      PRIORITY,
      `Reserva permitida com no máximo ${maxDays} dias de antecedência.`,
      maxDays,
      { horasAteEvento: Math.floor(hrs) }
    );
  }
  return pass("ANTECEDENCIA_MAX", PRIORITY, "Dentro do horizonte de reserva.", maxDays);
};
