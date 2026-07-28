/**
 * REGRA: AREA_INATIVA (BLOCKER)
 *
 * Paridade: criar/route.ts:113, fila/aceitar:69-78, fila-assumir:167-169.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass } from "./_shared";

const CODE = "AREA_INATIVA" as const;
const PRIORITY = "BLOCKER" as const;

export const activeAreaRule: RuleEvaluator = (_policy, ctx) => {
  if (!ctx.area.ativo) {
    return fail(CODE, PRIORITY, "Área desativada.", true, { areaId: ctx.target.areaId });
  }
  return pass(CODE, PRIORITY, "Área ativa.", true);
};
