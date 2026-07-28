/**
 * FASE D.3 — POLICY ENGINE — VALIDATOR.
 *
 * Pipeline puro e síncrono: recebe a política COMPILADA e o contexto (fatos)
 * e devolve a decisão. Nenhum I/O. Nenhuma regra própria — apenas orquestra
 * o catálogo, na ordem registrada, respeitando as prioridades (D.3 §3):
 *
 *   BLOCKER    → FAIL interrompe a avaliação imediatamente;
 *   VALIDATION → FAIL acumula violação (segue avaliando p/ explain completo);
 *   WARNING    → FAIL vira aviso, não impede a ação;
 *   INFO       → nunca impede.
 *
 * Também produz requiresApproval e FinancialDecision com paridade exata ao
 * motor congelado (criar/route.ts:161-166 e cancelar/route.ts:184-195).
 */

import type {
  CompiledPolicy,
  FinancialDecision,
  PolicyContext,
  ReservaAction,
  RuleExplanation,
  RuleResult,
  ValidationResult,
} from "./types";
import { rulesForAction } from "./catalog";
import { hoursUntilEvent } from "./rules/_shared";

export function validate(
  action: ReservaAction,
  compiled: CompiledPolicy,
  ctx: PolicyContext
): ValidationResult {
  const results: RuleResult[] = [];
  const violations: RuleResult[] = [];
  const warnings: RuleResult[] = [];
  let haltedByBlocker = false;

  for (const rule of rulesForAction(action)) {
    const result = rule.evaluate(compiled, ctx);
    results.push(result);

    if (result.outcome !== "FAIL") continue;

    if (result.priority === "BLOCKER") {
      violations.push(result);
      haltedByBlocker = true;
      break;
    }
    if (result.priority === "VALIDATION") {
      violations.push(result);
    } else {
      warnings.push(result);
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
    warnings,
    results,
    haltedByBlocker,
    requiresApproval: computeRequiresApproval(compiled, ctx),
    financial: computeFinancialDecision(action, compiled, ctx),
  };
}

/**
 * Paridade com criar/route.ts:166:
 *   precisaAprovacao = !hasFee && horas < exigirAprovacaoQuandoMenosQueHoras
 */
function computeRequiresApproval(compiled: CompiledPolicy, ctx: PolicyContext): boolean {
  const hasFee = ctx.priceCentavos > 0;
  if (hasFee) return false;
  const hrs = hoursUntilEvent(ctx.dateStr, ctx.nowMs);
  return hrs < compiled.policy.booking.requireApprovalUnderHours;
}

/**
 * Paridade com o motor congelado:
 *  - hasFee ⇒ reserva nasce PENDENTE_PAGAMENTO (criar/route.ts:165);
 *  - cancelamento dentro da janela ⇒ fluxo financeiro atual (REFUND/cancelamento
 *    da cobrança); fora da janela só operador chega aqui (bypass) ⇒ igual.
 */
function computeFinancialDecision(
  action: ReservaAction,
  compiled: CompiledPolicy,
  ctx: PolicyContext
): FinancialDecision {
  const feeOverride = compiled.policy.financial.feeCentavos;
  const feeCentavos = feeOverride != null ? feeOverride : ctx.priceCentavos;

  if (action === "CANCEL") {
    return {
      feeCentavos,
      requiresPaymentBeforeApproval: false,
      cancellationOutcome: feeCentavos > 0 ? "REFUND" : "NOT_APPLICABLE",
      penaltyCentavos: 0,
    };
  }

  return {
    feeCentavos,
    requiresPaymentBeforeApproval: feeCentavos > 0,
    cancellationOutcome: "NOT_APPLICABLE",
    penaltyCentavos: 0,
  };
}

/**
 * explain() — ajuste obrigatório D.3 §4.
 * Para cada regra da ação: artigo → regra → resultado → valor utilizado →
 * origem da política (proveniência hierárquica) → mensagem.
 */
export function explain(
  action: ReservaAction,
  compiled: CompiledPolicy,
  ctx: PolicyContext
): RuleExplanation[] {
  const out: RuleExplanation[] = [];
  for (const rule of rulesForAction(action)) {
    const result = rule.evaluate(compiled, ctx);
    out.push({
      article: rule.article,
      ruleCode: rule.code,
      ruleTitle: rule.title,
      outcome: result.outcome,
      priority: rule.priority,
      valueUsed: result.valueUsed,
      origin: rule.policyPath ? compiled.provenance[rule.policyPath] ?? "DEFAULT" : null,
      message: result.message,
    });
  }
  return out;
}
