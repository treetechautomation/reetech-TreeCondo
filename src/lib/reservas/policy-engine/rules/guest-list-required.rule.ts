/**
 * D.11.5 — REGRA: LISTA_CONVIDADOS_OBRIGATORIA (BLOCKER).
 *
 * Art. 21: lista de convidados exigida para a área. SKIPa se não configurado.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "LISTA_CONVIDADOS_OBRIGATORIA" as const;
const PRIORITY = "BLOCKER" as const;

export const guestListRequiredRule: RuleEvaluator = (_policy, ctx) => {
  const required = _policy.policy.capacity.guestList.required;
  if (!required) {
    return skip(CODE, PRIORITY, "Lista de convidados não é obrigatória.", false);
  }
  if (ctx.guestCount == null || ctx.guestCount === 0) {
    return fail(CODE, PRIORITY, "Lista de convidados obrigatória não foi preenchida.", null, {
      guestCount: ctx.guestCount ?? 0,
    });
  }
  return pass(CODE, PRIORITY, "Lista de convidados preenchida.", ctx.guestCount);
};
