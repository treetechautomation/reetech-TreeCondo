/**
 * REGRA: BLOCO_NAO_PERMITIDO (BLOCKER)
 *
 * Paridade com o motor congelado (5 ocorrências absorvidas):
 *  - criar/route.ts:272-277, fila/aceitar:80-97, fila-assumir:171-178,
 *    reservasPromocaoFila.ts:90-99, useReservas.ts:344-351 (filtro visual).
 *
 * Semântica homologada: só se aplica quando escopo=BLOCO E a lista de blocos
 * permitidos é não-vazia; membro sem bloco normalizado ⇒ negado.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "BLOCO_NAO_PERMITIDO" as const;
const PRIORITY = "BLOCKER" as const;

export const blockScopeRule: RuleEvaluator = (policy, ctx) => {
  const { scope, allowedBlocks } = policy.policy.eligibility;
  if (scope !== "BLOCO" || !Array.isArray(allowedBlocks) || allowedBlocks.length === 0) {
    return skip(CODE, PRIORITY, "Área sem restrição de bloco.", scope);
  }
  const bloco = ctx.actor.blocoIdNorm;
  if (!bloco || !allowedBlocks.includes(bloco)) {
    return fail(CODE, PRIORITY, "Esta área é exclusiva para moradores de outro bloco.", allowedBlocks, {
      blocoDoMembro: bloco || null,
    });
  }
  return pass(CODE, PRIORITY, "Bloco permitido para esta área.", allowedBlocks);
};
