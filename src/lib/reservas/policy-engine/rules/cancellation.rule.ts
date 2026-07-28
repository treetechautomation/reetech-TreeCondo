/**
 * REGRA: CANCELAMENTO_TARDIO (VALIDATION)
 *
 * Paridade: cancelar/route.ts:184-195 —
 *  - janela mínima de 48h antes do evento (agora > limite ⇒ nega);
 *  - operador cancela mesmo fora do prazo (operatorBypass=true).
 *
 * Diferente do hardcode atual, o valor vem SEMPRE da política (snapshot da
 * reserva quando existir), como definido na D.2.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "CANCELAMENTO_TARDIO" as const;
const PRIORITY = "VALIDATION" as const;

export const cancellationWindowRule: RuleEvaluator = (policy, ctx) => {
  const c = policy.policy.cancellation;
  if (!ctx.reserva) {
    return skip(CODE, PRIORITY, "Sem reserva no contexto — regra não se aplica.", c.minHoursBeforeEvent);
  }
  if (ctx.isOperatorAction && c.operatorBypass) {
    return skip(
      CODE,
      PRIORITY,
      "Operador isento da janela de cancelamento (comportamento homologado).",
      c.minHoursBeforeEvent
    );
  }
  const limiteMs = ctx.reserva.eventMs - c.minHoursBeforeEvent * 3_600_000;
  if (ctx.nowMs > limiteMs) {
    return fail(
      CODE,
      PRIORITY,
      `Cancelamento permitido somente até ${c.minHoursBeforeEvent}h antes da reserva.`,
      c.minHoursBeforeEvent,
      { limiteISO: new Date(limiteMs).toISOString() }
    );
  }
  return pass(CODE, PRIORITY, "Dentro da janela de cancelamento.", c.minHoursBeforeEvent);
};
