/**
 * D.11.5 — REGRA: NO_SHOW_PENALIDADE (VALIDATION).
 *
 * Art. 29/34: penalidade financeira por no-show. SKIPa se não configurada.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "NO_SHOW_PENALIDADE" as const;
const PRIORITY = "VALIDATION" as const;

export const noShowPenaltyRule: RuleEvaluator = (_policy, ctx) => {
  const penalty = _policy.policy.cancellation.noShowPenaltyCentavos;
  if (penalty == null || penalty <= 0) {
    return skip(CODE, PRIORITY, "Sem penalidade de no-show configurada.", null);
  }
  const recentNoShows = ctx.actor.recentNoShows;
  if (recentNoShows > 0) {
    return fail(CODE, PRIORITY, `Penalidade por no-show: R$${(penalty / 100).toFixed(2)}.`, penalty, {
      recentNoShows,
      noShowPenaltyCentavos: penalty,
    });
  }
  return pass(CODE, PRIORITY, "Sem no-shows recentes.", 0);
};
