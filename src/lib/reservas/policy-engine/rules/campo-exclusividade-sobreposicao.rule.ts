/**
 * FASE 16.10 / R2 — REGRA: CAMPO_EXCLUSIVIDADE_SOBREPOSICAO (VALIDATION).
 *
 * Valida que o intervalo solicitado para uso do Campo não sobrepõe
 * uma exclusividade ativa (HOLD ou ATIVA) no campoAgenda do dia.
 *
 * Esta regra é consultiva — o enforcement real está na transação
 * cross-domain via campoAgenda/{dateStr}.
 *
 * Aplica-se a: CAMPO_REGISTRAR.
 */

import type { RuleEvaluator } from "../types";
import { pass, skip } from "./_shared";

const CODE = "CAMPO_EXCLUSIVIDADE_SOBREPOSICAO" as const;
const PRIORITY = "VALIDATION" as const;

export const campoExclusividadeSobreposicaoRule: RuleEvaluator = (_policy, ctx) => {
  const e = _policy.policy.campo.exclusividade;

  if (!e.habilitada) {
    return skip(CODE, PRIORITY, "Exclusividade não habilitada — sem validação de sobreposição.", null);
  }

  // A validação real de sobreposição é feita na transação cross-domain
  // (leitura do campoAgenda). Esta regra apenas sinaliza que o mecanismo
  // existe. Enforcement via runTransaction em campo/registrar.
  return pass(CODE, PRIORITY, "Validação de exclusividade delegada à transação cross-domain.", e);
};
