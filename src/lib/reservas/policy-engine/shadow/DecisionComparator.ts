/**
 * FASE D.4 — SHADOW MODE — DECISION COMPARATOR.
 *
 * Compara a decisão do motor atual (congelado) com a decisão do Policy Engine.
 * NUNCA lança exceções. NUNCA altera o fluxo. NUNCA altera a resposta HTTP.
 *
 * Responsabilidade única:
 *   - Receber ação, contexto, resultado do motor e resultado do engine
 *   - Comparar: permitido/bloqueado, artigo, mensagem, código, prioridade, valor, origem
 *   - Classificar divergências: CRITICAL_DECISION, RULE_MISMATCH, DETAIL_MISMATCH
 *   - Emitir log estruturado de divergência (console apenas nesta fase)
 *
 * Controle de volume:
 *   - POLICY_ENGINE_SHADOW_LOG_MATCHES=true  → registra MATCH e DIVERGENCE
 *   - ausente ou false                        → registra apenas DIVERGENCE e ERROR
 */

import type {
  ISODate,
  PolicyContext,
  PolicyTargetRef,
  ReservaAction,
  RuleCode,
  RulePriority,
  ValidationResult,
} from "../types";

/** Classificação de divergência D.4.2. */
export type DivergenceType =
  | "CRITICAL_DECISION"
  | "RULE_MISMATCH"
  | "DETAIL_MISMATCH"
  | "SHADOW_ERROR"
  | "OPERATIONAL_OUTCOME";

/** Decisão que o motor atual (congelado) tomou. */
export type MotorDecision = {
  /** Ação que o motor efetivamente executou (CREATE ou QUEUE_JOIN). */
  action: ReservaAction;
  /** A ação foi permitida pelo motor? */
  allowed: boolean;
  /** Modo da reserva criada (apenas quando allowed=true). */
  mode?: "RESERVA" | "FILA";
  /** Código da regra que bloqueou (apenas quando allowed=false). */
  blockRule?: RuleCode;
  /** Prioridade estimada do bloqueio. */
  blockPriority?: RulePriority;
  /** Artigo/mensagem do bloqueio. */
  blockMessage?: string;
  /** Valor da política utilizado pelo motor. */
  blockValueUsed?: unknown;
  /** Origem do valor (área, condomínio, default). */
  blockOrigin?: "OPCAO" | "AREA" | "CONDOMINIO" | "DEFAULT";
  /** Timestamp da decisão (ms). */
  decidedAtMs: number;
};

/** Resultado da comparação shadow. */
export type ComparisonResult = {
  match: boolean;
  /** Classificação da divergência (null quando match). */
  divergenceType: DivergenceType | null;
  differences: string[];
  motor: MotorDecision;
  policy: {
    allowed: boolean;
    violations: Array<{
      code: RuleCode;
      priority: RulePriority;
      message: string;
      valueUsed?: unknown;
    }>;
    haltedByBlocker: boolean;
    requiresApproval: boolean;
  };
};

/**
 * Mapeia a decisão do motor para um MotorDecision estruturado.
 * Entrada: o que o motor decidiu em linguagem natural.
 */
export function motorDecision(input: {
  action: ReservaAction;
  allowed: boolean;
  mode?: "RESERVA" | "FILA";
  blockRule?: RuleCode;
  blockPriority?: RulePriority;
  blockMessage?: string;
  blockValueUsed?: unknown;
  blockOrigin?: "OPCAO" | "AREA" | "CONDOMINIO" | "DEFAULT";
}): MotorDecision {
  return {
    ...input,
    decidedAtMs: Date.now(),
  };
}

/**
 * Compara a decisão do motor com o resultado do Policy Engine.
 * Classifica divergências: CRITICAL_DECISION, RULE_MISMATCH, DETAIL_MISMATCH.
 * NUNCA lança exceções.
 */
export function compare(
  motor: MotorDecision,
  policyResult: ValidationResult
): ComparisonResult {
  const differences: string[] = [];
  let divergenceType: DivergenceType | null = null;

  try {
    const decisionMismatch = motor.allowed !== policyResult.allowed;

    if (decisionMismatch) {
      divergenceType = "CRITICAL_DECISION";
      differences.push(
        `allowed: motor=${motor.allowed} policy=${policyResult.allowed}`
      );
    }

    if (!motor.allowed && !policyResult.allowed) {
      const pvCodes = policyResult.violations.map((v) => v.code);

      if (motor.blockRule && !pvCodes.includes(motor.blockRule)) {
        differences.push(
          `blockRule: motor=${motor.blockRule} policy_violations=[${pvCodes.join(",")}]`
        );
        if (!divergenceType) divergenceType = "RULE_MISMATCH";
      }

      if (motor.blockRule && pvCodes.length === 1 && pvCodes[0] !== motor.blockRule) {
        differences.push(
          `blockRuleMismatch: motor=${motor.blockRule} policy=${pvCodes[0]}`
        );
        if (!divergenceType) divergenceType = "RULE_MISMATCH";
      }

      if (pvCodes.length === 0) {
        differences.push(
          `policyAllowed: motor blocked with ${motor.blockRule ?? "unknown"} but policy has no violations`
        );
        if (!divergenceType) divergenceType = "CRITICAL_DECISION";
      }
    }

    if (motor.blockRule && policyResult.violations.length > 0) {
      const matched = policyResult.violations.find(
        (v) => v.code === motor.blockRule
      );
      if (matched) {
        let detailDiff = false;
        if (
          motor.blockPriority &&
          matched.priority !== motor.blockPriority
        ) {
          differences.push(
            `priority: motor=${motor.blockPriority} policy=${matched.priority} (${motor.blockRule})`
          );
          detailDiff = true;
        }
        if (
          motor.blockMessage &&
          matched.message !== motor.blockMessage
        ) {
          differences.push(
            `message: motor="${motor.blockMessage}" policy="${matched.message}"`
          );
          detailDiff = true;
        }
        if (
          motor.blockValueUsed !== undefined &&
          JSON.stringify(matched.valueUsed) !==
            JSON.stringify(motor.blockValueUsed)
        ) {
          differences.push(
            `valueUsed: motor=${JSON.stringify(motor.blockValueUsed)} policy=${JSON.stringify(matched.valueUsed)}`
          );
          detailDiff = true;
        }
        if (detailDiff && !divergenceType) {
          divergenceType = "DETAIL_MISMATCH";
        }
      }
    }
  } catch (err) {
    differences.push(`comparisonError: ${String(err)}`);
    divergenceType = "SHADOW_ERROR";
  }

  return {
    match: differences.length === 0,
    divergenceType,
    differences,
    motor,
    policy: {
      allowed: policyResult.allowed,
      violations: policyResult.violations.map((v) => ({
        code: v.code,
        priority: v.priority,
        message: v.message,
        valueUsed: v.valueUsed,
      })),
      haltedByBlocker: policyResult.haltedByBlocker,
      requiresApproval: policyResult.requiresApproval,
    },
  };
}

// ── Shadow Context ────────────────────────────────────────────────────────────

export type ShadowCreateContext = {
  condominioId: string;
  areaId: string;
  opcaoId: string;
  dateStr: ISODate;
  uid: string;
  actorUid: string;
  actorIsSuperAdmin: boolean;
  actorRole: string;
  priceCentavos: number;
  isOperatorAction: boolean;
};

/** Nomes das regras do motor para log amigável. */
const MOTOR_RULE_LABELS: Record<string, string> = {
  DATA_PASSADA: "Data passada (linha 100)",
  DIA_SEMANA_BLOQUEADO: "Domingo (linha 105)",
  FERIADO_BLOQUEADO: "Feriado (linha 106)",
  AREA_INATIVA: "Área inativa (linha 113)",
  MEMBRO_INATIVO: "Membro inativo (linha 258)",
  BLOCO_NAO_PERMITIDO: "Bloco não permitido (linha 275)",
  FILA_CHEIA: "Fila cheia (linha 454)",
  LOCK_CONFLICT: "Lock já existente (linha 289)",
  COMPOUND_OCCUPIED: "Recurso composto ocupado (linha 321)",
};

/**
 * Emite log estruturado de divergência.
 * Fase D.4: apenas console. Nunca grava no Firestore.
 * Sempre registra, independente de env vars.
 */
export function logDivergence(result: ComparisonResult): void {
  if (result.match) return;

  const motor = result.motor;
  const label =
    MOTOR_RULE_LABELS[motor.blockRule ?? ""] ?? motor.blockRule ?? "desconhecida";

  const log = {
    phase: "D.4_SHADOW",
    type: "DIVERGENCE",
    divergenceType: result.divergenceType ?? "UNKNOWN",
    timestamp: new Date().toISOString(),
    action: motor.action,
    motor: {
      allowed: motor.allowed,
      mode: motor.mode ?? null,
      blockRule: motor.blockRule ?? null,
      blockLabel: label,
      blockPriority: motor.blockPriority ?? null,
      blockMessage: motor.blockMessage ?? null,
      blockValueUsed: motor.blockValueUsed ?? null,
      blockOrigin: motor.blockOrigin ?? null,
      decidedAt: new Date(motor.decidedAtMs).toISOString(),
    },
    policyEngine: {
      allowed: result.policy.allowed,
      violations: result.policy.violations,
      haltedByBlocker: result.policy.haltedByBlocker,
      requiresApproval: result.policy.requiresApproval,
    },
    differences: result.differences,
  };

  console.error("[Shadow:DIVERGENCE]", JSON.stringify(log, null, 2));
}

/**
 * Emite log de paridade (match).
 * Controlado por POLICY_ENGINE_SHADOW_LOG_MATCHES:
 *   - "true"  → registra MATCH
 *   - ausente ou qualquer outro valor → silencia (apenas DIVERGENCE e ERROR)
 */
export function logMatch(
  motor: MotorDecision,
  policyResult: ValidationResult
): void {
  const enabled = process.env.POLICY_ENGINE_SHADOW_LOG_MATCHES === "true";
  if (!enabled) return;

  console.log(
    "[Shadow:MATCH]",
    JSON.stringify({
      phase: "D.4_SHADOW",
      type: "MATCH",
      timestamp: new Date().toISOString(),
      action: motor.action,
      allowed: motor.allowed,
      mode: motor.mode ?? null,
      blockRule: motor.blockRule ?? null,
      policyViolations: policyResult.violations.map((v) => v.code),
    })
  );
}

/**
 * Registra decisão OPERACIONAL do motor (lock, slot ocupado, concorrência)
 * que está FORA do escopo do Policy Engine.
 *
 * D.4.2: Bloqueios transacionais (reservasPorUid, compound occupied)
 * são infraestrutura, não política. Registrados como OPERATIONAL_OUTCOME,
 * nunca como CRITICAL_DECISION.
 *
 * Sempre registra, independente de POLICY_ENGINE_SHADOW_LOG_MATCHES.
 */
export function logOperational(
  action: ReservaAction,
  reason: string,
  message: string,
  ctx: ShadowCreateContext
): void {
  console.log(
    "[Shadow:OPERATIONAL]",
    JSON.stringify({
      phase: "D.4_SHADOW",
      type: "OPERATIONAL_OUTCOME",
      divergenceType: "OPERATIONAL_OUTCOME",
      timestamp: new Date().toISOString(),
      action,
      reason,
      message,
      condominioId: ctx.condominioId,
      areaId: ctx.areaId,
      dateStr: ctx.dateStr,
      uid: ctx.uid,
      note: "Decisão operacional do motor — fora do escopo do Policy Engine. NÃO é divergência de política.",
    })
  );
}
