/**
 * FASE 16.10 / R2 — REGRA: CAMPO_EXCLUSIVIDADE_DIA_INVALIDO (VALIDATION).
 *
 * Valida que a opção com_campo só é permitida nos dias configurados
 * na policy de exclusividade do condomínio.
 *
 * Aplica-se a: CREATE, QUEUE_JOIN (quando opcaoId === "com_campo").
 * SKIPa se: opção não for com_campo ou exclusividade não habilitada.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip, weekdayOfISO } from "./_shared";

const CODE = "CAMPO_EXCLUSIVIDADE_DIA_INVALIDO" as const;
const PRIORITY = "VALIDATION" as const;

export const campoExclusividadeDiaRule: RuleEvaluator = (_policy, ctx) => {
  const e = _policy.policy.campo.exclusividade;

  if (!e.habilitada) {
    return skip(CODE, PRIORITY, "Exclusividade não habilitada para este condomínio.", null);
  }

  // A regra só se aplica quando a área alvo é a Churrasqueira 2
  if (ctx.target.areaId !== "churrasqueira_2") {
    return skip(CODE, PRIORITY, "Exclusividade não se aplica a esta área.", null);
  }

  if (!e.diasPermitidos || e.diasPermitidos.length === 0) {
    return skip(CODE, PRIORITY, "Nenhum dia de exclusividade configurado.", null);
  }

  const weekday = weekdayOfISO(ctx.dateStr);

  if (!e.diasPermitidos.includes(weekday)) {
    return fail(CODE, PRIORITY, "A exclusividade do Campo só está disponível nos dias configurados pela administração.", e, {
      weekday,
      diasPermitidos: e.diasPermitidos,
    });
  }

  return pass(CODE, PRIORITY, "Dia permitido para exclusividade do Campo.", e);
};
