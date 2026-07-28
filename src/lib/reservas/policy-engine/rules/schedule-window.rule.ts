/**
 * D.11.5 — REGRA: JANELA_HORARIA (VALIDATION).
 *
 * Art. 31: reserva deve respeitar janela horária da área/opção.
 * SKIPa se a área é diaInteiro (comportamento homologado) ou sem horário.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "JANELA_HORARIA" as const;
const PRIORITY = "VALIDATION" as const;

export const scheduleWindowRule: RuleEvaluator = (_policy, ctx) => {
  const s = _policy.policy.schedule;
  if (s.allDay || (s.startHour == null && s.endHour == null)) {
    return skip(CODE, PRIORITY, "Área dia inteiro — sem restrição horária.", null);
  }
  const now = new Date(ctx.nowMs);
  const currentHour = now.getHours();
  if (s.startHour != null && currentHour < s.startHour) {
    return fail(CODE, PRIORITY, `Reservas permitidas apenas a partir das ${s.startHour}h.`, s, {
      currentHour,
      startHour: s.startHour,
    });
  }
  if (s.endHour != null && currentHour >= s.endHour) {
    return fail(CODE, PRIORITY, `Reservas permitidas apenas até as ${s.endHour}h.`, s, {
      currentHour,
      endHour: s.endHour,
    });
  }
  return pass(CODE, PRIORITY, "Dentro da janela horária permitida.", s);
};
