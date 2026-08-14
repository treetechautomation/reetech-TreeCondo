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
  // R1.0 — Etapa 0.1 (P1 #1): hora civil em America/Sao_Paulo, independente
  // do timezone do host/processo — nunca usar Date.prototype.getHours().
  const currentHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(
      new Date(ctx.nowMs)
    )
  );
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
