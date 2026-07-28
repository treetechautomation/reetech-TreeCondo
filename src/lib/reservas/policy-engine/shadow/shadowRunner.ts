/**
 * FASE D.5 — SHADOW RUNNER COMPARTILHADO.
 *
 * Função de conveniência para executar o Policy Engine em shadow mode
 * a partir de qualquer rota. Sem duplicação. Sem refatoração do motor.
 *
 * NUNCA lança exceções. NUNCA altera o fluxo. NUNCA escreve no Firestore.
 */

import { adminDb } from "@/lib/firebaseAdmin";
import { getCompiledPolicy, makeContext } from "../index";
import { createAdminPolicyRepository } from "../adapters/admin";
import { createCachedPolicyRepository } from "../repository";
import { validate } from "../validator";
import type { PolicyContext, ReservaAction, ValidationResult } from "../types";
import {
  compare,
  MotorDecision,
  motorDecision,
  logDivergence,
  logMatch,
  logOperational,
  type ShadowCreateContext,
} from "./DecisionComparator";

export type { MotorDecision, ShadowCreateContext };
export { motorDecision, logOperational };

/**
 * Executa o Policy Engine em shadow e compara com a decisão do motor.
 * Fire-and-forget: sempre chame com .catch(() => {}) no callsite.
 */
export async function shadowEvaluate(
  db: ReturnType<typeof adminDb>,
  motor: MotorDecision,
  ctx: ShadowCreateContext & {
    /** Facts adicionais para ações específicas. */
    reservaEventMs?: number;
    reservaStatus?: string;
    reservaValor?: number;
    offerExpiresAtMs?: number | null;
    actorStatus?: string;
    actorExists?: boolean;
    areaAtivo?: boolean;
    queueSize?: number;
    memberFactsOverride?: Partial<PolicyContext["actor"]>;
  },
): Promise<void> {
  try {
    const repo = createCachedPolicyRepository(createAdminPolicyRepository(db));
    const compiled = await getCompiledPolicy(repo, {
      condominioId: ctx.condominioId,
      areaId: ctx.areaId,
      opcaoId: ctx.opcaoId !== "base" ? ctx.opcaoId : undefined,
    });

    const memberFacts = await repo.getMemberFacts(ctx.condominioId, ctx.uid);
    memberFacts.isSuperAdmin = ctx.actorIsSuperAdmin;

    if (ctx.memberFactsOverride) {
      Object.assign(memberFacts, ctx.memberFactsOverride);
    }

    const quotaFacts = await repo.getQuotaFacts(ctx.condominioId, {
      areaId: ctx.areaId,
      dateStr: ctx.dateStr,
      uid: ctx.uid,
      unidadeIdNorm: ctx.memberFactsOverride?.unidadeIdNorm ?? null,
    });

    if (ctx.queueSize != null) {
      quotaFacts.queueSizeForSlot = ctx.queueSize;
    }

    const now = new Date();
    const policyContext = makeContext({
      now,
      dateStr: ctx.dateStr,
      target: {
        condominioId: ctx.condominioId,
        areaId: ctx.areaId,
        opcaoId: ctx.opcaoId !== "base" ? ctx.opcaoId : undefined,
      },
      actor: memberFacts,
      area: { ativo: ctx.areaAtivo ?? true },
      quota: quotaFacts,
      priceCentavos: ctx.priceCentavos,
      isOperatorAction: ctx.isOperatorAction,
      ...(ctx.reservaEventMs != null
        ? { reserva: { eventMs: ctx.reservaEventMs, status: ctx.reservaStatus ?? "", valorCobradoCentavos: ctx.reservaValor ?? 0 } }
        : {}),
      ...(ctx.offerExpiresAtMs != null
        ? { offer: { expiresAtMs: ctx.offerExpiresAtMs } }
        : {}),
    });

    const policyResult = validate(motor.action, compiled, policyContext);
    const comparison = compare(motor, policyResult);

    if (comparison.match) {
      logMatch(motor, policyResult);
    } else {
      logDivergence(comparison);
    }
  } catch (err) {
    console.error("[Shadow:ERROR]", String(err));
  }
}
