/**
 * FASE D.6 — POLICY ENGINE — DECISION DISPATCHER.
 *
 * Ponto ÚNICO de despacho de decisões entre o motor legado e o Policy Engine,
 * controlado por Feature Flag (featureFlags.ts).
 *
 * Responsabilidade:
 *   1. Receber contexto + ação (+ decisão já computada pelo motor legado);
 *   2. Consultar a Feature Flag (getEngineMode);
 *   3. Executar o modo ativo: LEGACY | SHADOW | POLICY | DISABLED.
 *
 * Garantias (invariantes da fase):
 *   - NUNCA lança exceção para o chamador;
 *   - NUNCA escreve no Firestore (somente leitura, herdada dos adapters);
 *   - Falha/timeout do Policy Engine ⇒ forceLegacy() — rollback imediato,
 *     resposta segue o motor legado; usuário JAMAIS recebe erro por falha
 *     do Policy Engine;
 *   - Em SHADOW o comportamento é EXATAMENTE o atual (D.5): shadowEvaluate
 *     fire-and-forget, logs [Shadow:*] preservados sem alteração.
 *
 * Telemetria: contadores em memória (getDispatcherTelemetry). Console apenas.
 * Nunca grava Firestore.
 */

import type { Firestore } from "firebase-admin/firestore";
import { getCompiledPolicy, makeContext } from "./index";
import { createAdminPolicyRepository } from "./adapters/admin";
import { createCachedPolicyRepository } from "./repository";
import { validate } from "./validator";
import type { PolicyContext, ValidationResult } from "./types";
import {
  getEngineMode,
  getPolicyTimeoutMs,
  type EngineMode,
} from "./featureFlags";
import {
  shadowEvaluate,
  type MotorDecision,
  type ShadowCreateContext,
} from "./shadow/shadowRunner";

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Mesmo contrato de contexto usado pelo shadow (D.5) — sem novos campos. */
export type DispatchContext = ShadowCreateContext & {
  reservaEventMs?: number;
  reservaStatus?: string;
  reservaValor?: number;
  offerExpiresAtMs?: number | null;
  actorStatus?: string;
  actorExists?: boolean;
  areaAtivo?: boolean;
  queueSize?: number;
  memberFactsOverride?: Partial<PolicyContext["actor"]>;
};

export type DispatchOutcome = {
  /** Motor que efetivamente tomou a decisão devolvida em `allowed`. */
  engine: "LEGACY" | "POLICY";
  /** Modo de Feature Flag vigente no momento do despacho. */
  mode: EngineMode;
  /** Decisão oficial — a rota deve respeitá-la. */
  allowed: boolean;
  /** true quando houve forceLegacy() (falha/timeout do Policy Engine). */
  rolledBack: boolean;
  /** Resultado completo do engine (apenas em POLICY bem-sucedido). */
  policyResult: ValidationResult | null;
  /** Mensagem da primeira violação (apenas quando POLICY bloqueia). */
  blockMessage: string | null;
};

// ── Telemetria (memória/console apenas — NUNCA Firestore) ───────────────────

type PerActionCounter = Record<string, number>;

type DispatcherTelemetry = {
  LEGACY: number;
  POLICY: number;
  SHADOW: number;
  ROLLBACKS: number;
  /** Contagem por ação (pela decisão do engine ativo). */
  byAction: PerActionCounter;
};

const counters: DispatcherTelemetry = {
  LEGACY: 0,
  POLICY: 0,
  SHADOW: 0,
  ROLLBACKS: 0,
  byAction: {},
};

function bumpAction(action: string): void {
  counters.byAction[action] = (counters.byAction[action] ?? 0) + 1;
}

export function getDispatcherTelemetry(): Readonly<DispatcherTelemetry> {
  return { ...counters, byAction: { ...counters.byAction } };
}

export function resetDispatcherTelemetry(): void {
  counters.LEGACY = 0;
  counters.POLICY = 0;
  counters.SHADOW = 0;
  counters.ROLLBACKS = 0;
  counters.byAction = {};
}

// ── Avaliação do Policy Engine (mesma montagem de contexto do shadow D.5) ───

async function evaluatePolicyDecision(
  db: Firestore,
  motor: MotorDecision,
  ctx: DispatchContext,
): Promise<ValidationResult> {
  const repo = createCachedPolicyRepository(createAdminPolicyRepository(db));

  // Leituras independentes em paralelo (latência real de produção — D.6).
  const [compiled, rawMemberFacts, quotaFacts] = await Promise.all([
    getCompiledPolicy(repo, {
      condominioId: ctx.condominioId,
      areaId: ctx.areaId,
      opcaoId: ctx.opcaoId !== "base" ? ctx.opcaoId : undefined,
    }),
    repo.getMemberFacts(ctx.condominioId, ctx.uid),
    repo.getQuotaFacts(ctx.condominioId, {
      areaId: ctx.areaId,
      dateStr: ctx.dateStr,
      uid: ctx.uid,
      unidadeIdNorm: ctx.memberFactsOverride?.unidadeIdNorm ?? null,
    }),
  ]);

  const memberFacts = rawMemberFacts;
  memberFacts.isSuperAdmin = ctx.actorIsSuperAdmin;

  if (ctx.memberFactsOverride) {
    Object.assign(memberFacts, ctx.memberFactsOverride);
  }

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

  return validate(motor.action, compiled, policyContext);
}

// Indireção para testes (node:test, sem framework de mock).
type DispatcherDeps = {
  evaluatePolicy: typeof evaluatePolicyDecision;
  shadow: typeof shadowEvaluate;
};

const defaultDeps: DispatcherDeps = {
  evaluatePolicy: evaluatePolicyDecision,
  shadow: shadowEvaluate,
};

let deps: DispatcherDeps = defaultDeps;

export function __setDispatcherDepsForTests(
  partial: Partial<DispatcherDeps>,
): void {
  deps = { ...defaultDeps, ...partial };
}

export function __resetDispatcherDepsForTests(): void {
  deps = defaultDeps;
}

// ── Timeout ──────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`POLICY_TIMEOUT: Policy Engine excedeu ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// ── forceLegacy (rollback imediato) ──────────────────────────────────────────

/**
 * Rollback imediato para o motor legado.
 * Chamado em: exceção, timeout ou indisponibilidade do Policy Engine.
 * A resposta ao usuário segue a decisão legada — nunca um erro do engine.
 */
export function forceLegacy(
  motor: MotorDecision,
  mode: EngineMode,
  reason: string,
): DispatchOutcome {
  counters.ROLLBACKS += 1;
  counters.LEGACY += 1;
  bumpAction(motor.action);
  console.error(
    "[Policy:ROLLBACK]",
    JSON.stringify({
      phase: "D.6_DISPATCHER",
      action: motor.action,
      mode,
      reason,
      fallback: "LEGACY",
      legacyAllowed: motor.allowed,
      timestamp: new Date().toISOString(),
    }),
  );
  return {
    engine: "LEGACY",
    mode,
    allowed: motor.allowed,
    rolledBack: true,
    policyResult: null,
    blockMessage: motor.blockMessage ?? null,
  };
}

function legacyOutcome(motor: MotorDecision, mode: EngineMode): DispatchOutcome {
  return {
    engine: "LEGACY",
    mode,
    allowed: motor.allowed,
    rolledBack: false,
    policyResult: null,
    blockMessage: motor.blockMessage ?? null,
  };
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Despacha uma decisão do módulo Reservas conforme a Feature Flag da ação.
 *
 *   DISABLED → decide o legado; engine desligado (sem shadow, sem logs);
 *   LEGACY   → decide o legado; Policy apenas observa (telemetria + log);
 *   SHADOW   → decide o legado; shadowEvaluate fire-and-forget (D.5 intacto);
 *   POLICY   → Policy Engine decide; legado registrado p/ auditoria;
 *              falha/timeout ⇒ forceLegacy().
 *
 * NUNCA lança exceção: qualquer falha interna degrada para o motor legado.
 */
export async function dispatchReservaDecision(
  db: Firestore,
  motor: MotorDecision,
  ctx: DispatchContext,
): Promise<DispatchOutcome> {
  let mode: EngineMode = "SHADOW";
  try {
    mode = getEngineMode(motor.action);

    if (mode === "DISABLED") {
      counters.LEGACY += 1;
      bumpAction(motor.action);
      return legacyOutcome(motor, mode);
    }

    if (mode === "LEGACY") {
      counters.LEGACY += 1;
      bumpAction(motor.action);
      console.log(
        "[Policy:LEGACY]",
        JSON.stringify({
          phase: "D.6_DISPATCHER",
          action: motor.action,
          legacyAllowed: motor.allowed,
          timestamp: new Date().toISOString(),
        }),
      );
      return legacyOutcome(motor, mode);
    }

    if (mode === "SHADOW") {
      counters.SHADOW += 1;
      bumpAction(motor.action);
      console.log(
        "[Policy:SHADOW]",
        JSON.stringify({
          phase: "D.6_DISPATCHER",
          action: motor.action,
          legacyAllowed: motor.allowed,
          timestamp: new Date().toISOString(),
        }),
      );
      // Comportamento D.5 preservado: fire-and-forget, logs [Shadow:*] intactos.
      deps.shadow(db, motor, ctx).catch(() => {});
      return legacyOutcome(motor, mode);
    }

    // ── POLICY: Policy Engine decide; motor legado executa p/ auditoria ─────
    try {
      const policyResult = await withTimeout(
        deps.evaluatePolicy(db, motor, ctx),
        getPolicyTimeoutMs(),
      );
      counters.POLICY += 1;
      bumpAction(motor.action);

      const firstViolation = policyResult.violations[0];
      console.log(
        "[Policy:ACTIVE]",
        JSON.stringify({
          phase: "D.6_DISPATCHER",
          action: motor.action,
          decidedBy: "POLICY",
          policyAllowed: policyResult.allowed,
          policyViolations: policyResult.violations.map((v) => v.code),
          legacyAllowed: motor.allowed, // auditoria do motor legado
          parity: policyResult.allowed === motor.allowed,
          timestamp: new Date().toISOString(),
        }),
      );

      return {
        engine: "POLICY",
        mode,
        allowed: policyResult.allowed,
        rolledBack: false,
        policyResult,
        blockMessage: firstViolation ? firstViolation.message : null,
      };
    } catch (err) {
      return forceLegacy(motor, mode, String(err));
    }
  } catch (err) {
    // Salvaguarda absoluta: nem falha do próprio dispatcher chega ao usuário.
    return forceLegacy(motor, mode, `DISPATCHER_ERROR: ${String(err)}`);
  }
}
