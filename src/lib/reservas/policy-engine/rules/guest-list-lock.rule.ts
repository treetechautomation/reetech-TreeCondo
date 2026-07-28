/**
 * D.11.5 — REGRA: LISTA_CONVIDADOS_BLOQUEIO (BLOCKER).
 *
 * Art. 24: edição da lista bloqueada após prazo. SKIPa se não configurado.
 */

import type { RuleEvaluator } from "../types";
import { fail, hoursUntilEvent, pass, skip } from "./_shared";

const CODE = "LISTA_CONVIDADOS_BLOQUEIO" as const;
const PRIORITY = "BLOCKER" as const;

export const guestListLockRule: RuleEvaluator = (_policy, ctx) => {
  const g = _policy.policy.capacity.guestList;
  if (!g.lockAfterDeadline || g.submitDeadlineHours <= 0) {
    return skip(CODE, PRIORITY, "Bloqueio após prazo não configurado.", g.submitDeadlineHours);
  }
  const hrs = hoursUntilEvent(ctx.dateStr, ctx.nowMs);
  if (hrs < g.submitDeadlineHours) {
    return fail(CODE, PRIORITY, `Lista de convidados bloqueada (${g.submitDeadlineHours}h antes).`, g.submitDeadlineHours, {
      horasRestantes: Math.floor(hrs),
    });
  }
  return pass(CODE, PRIORITY, "Lista de convidados ainda pode ser editada.", g.submitDeadlineHours);
};
