/**
 * REGRA: MEMBRO_INATIVO (BLOCKER)
 *
 * Paridade com o motor congelado (8 ocorrências absorvidas):
 *  - criar/route.ts:255-259, cancelar/route.ts:159-163, fila/aceitar:56-67,
 *    fila/rejeitar:39-50, fila-assumir:161-165, fila-cancelar:73-77,
 *    aprovar:93-106, reservasPromocaoFila.ts:70-87.
 *  - super_admin/superAdmin ignora o check (criar/route.ts:255).
 */

import type { RuleEvaluator } from "../types";
import { fail, normStatus, pass, skip } from "./_shared";

const CODE = "MEMBRO_INATIVO" as const;
const PRIORITY = "BLOCKER" as const;

export const activeMemberRule: RuleEvaluator = (policy, ctx) => {
  if (!policy.policy.eligibility.requireActiveMember) {
    return skip(CODE, PRIORITY, "Política não exige membro ativo.", false);
  }
  if (ctx.actor.isSuperAdmin) {
    return skip(CODE, PRIORITY, "Super admin — verificação de membro ignorada (comportamento homologado).", true);
  }
  if (!ctx.actor.exists) {
    return fail(CODE, PRIORITY, "Morador não encontrado no condomínio.", true, {
      uid: ctx.actor.uid,
    });
  }
  const status = normStatus(ctx.actor.status);
  if (status !== "ATIVO") {
    return fail(CODE, PRIORITY, "Membro inativo.", true, {
      uid: ctx.actor.uid,
      status,
    });
  }
  return pass(CODE, PRIORITY, "Membro ativo.", true);
};
