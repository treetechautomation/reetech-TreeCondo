/**
 * FASE D.6 — POLICY ENGINE — FEATURE FLAGS.
 *
 * Responsabilidade ÚNICA:
 *   1. Leitura da configuração (env vars + overrides em memória);
 *   2. Decisão de QUAL motor está ativo para cada ação.
 *
 * NENHUMA lógica de negócio. NENHUM I/O. NENHUM import de Firebase.
 *
 * Modos suportados:
 *   - LEGACY   → motor legado decide; Policy Engine apenas observa;
 *   - SHADOW   → comportamento atual (D.4/D.5): legado decide, shadow compara;
 *   - POLICY   → Policy Engine decide; motor legado executa apenas p/ auditoria;
 *   - DISABLED → engine completamente desligado (nem shadow roda).
 *
 * ROLLBACK INSTANTÂNEO:
 *   - runtime (sem redeploy): setEngineModeOverride("APPROVE", "SHADOW");
 *   - deploy/env:             POLICY_ENGINE_MODE_APPROVE=SHADOW (ou LEGACY).
 *
 * Precedência (a primeira definida vence):
 *   override runtime por ação → override runtime global →
 *   env POLICY_ENGINE_MODE_<ACTION> → env POLICY_ENGINE_MODE →
 *   default da fase D.6 (APPROVE=POLICY; demais=SHADOW).
 */

import type { ReservaAction } from "./types";

export type EngineMode = "LEGACY" | "SHADOW" | "POLICY" | "DISABLED";

const VALID_MODES: ReadonlyArray<EngineMode> = [
  "LEGACY",
  "SHADOW",
  "POLICY",
  "DISABLED",
];

/**
 * EXPANSÃO — D.7:
 * APPROVE=POLICY (D.6), OFFER_REJECT=POLICY, OFFER_ACCEPT=POLICY,
 * QUEUE_PROMOTE=POLICY. CREATE/QUEUE_JOIN/CANCEL permanecem SHADOW.
 */
const DEFAULT_MODES: Readonly<Record<ReservaAction, EngineMode>> = {
  CREATE: "POLICY",
  CANCEL: "POLICY",
  QUEUE_JOIN: "POLICY",
  QUEUE_LEAVE: "SHADOW",
  QUEUE_PROMOTE: "POLICY",
  OFFER_ACCEPT: "POLICY",
  OFFER_REJECT: "POLICY",
  APPROVE: "POLICY",
  GUEST_LIST_EDIT: "SHADOW",
  CHECK_IN: "SHADOW",
  CAMPO_REGISTRAR: "POLICY",
  USO_COMUM_CONVIDADO_ADICIONAR: "POLICY",
};

/**
 * Timeout default (ms) para avaliação síncrona do Policy Engine em modo POLICY.
 * Calibrado na homologação runtime D.6: leituras frias do Firestore nesta
 * infraestrutura chegam a ~2,5s; timeout menor causaria rollback desnecessário.
 */
const DEFAULT_POLICY_TIMEOUT_MS = 4000;

// ── Overrides em memória (alternância/rollback instantâneo sem redeploy) ────
const runtimeOverrides = new Map<ReservaAction, EngineMode>();
let runtimeGlobalOverride: EngineMode | null = null;

function parseMode(raw: string | undefined | null): EngineMode | null {
  const v = String(raw ?? "").trim().toUpperCase();
  return (VALID_MODES as ReadonlyArray<string>).includes(v)
    ? (v as EngineMode)
    : null;
}

/** Decide o motor ativo para a ação (leitura pura de configuração). */
export function getEngineMode(action: ReservaAction): EngineMode {
  const perAction = runtimeOverrides.get(action);
  if (perAction) return perAction;

  if (runtimeGlobalOverride) return runtimeGlobalOverride;

  const envPerAction = parseMode(process.env[`POLICY_ENGINE_MODE_${action}`]);
  if (envPerAction) return envPerAction;

  const envGlobal = parseMode(process.env.POLICY_ENGINE_MODE);
  if (envGlobal) return envGlobal;

  return DEFAULT_MODES[action] ?? "SHADOW";
}

/**
 * Override em memória por ação. `null` remove o override.
 * Uso: rollback emergencial e testes. Efeito imediato (por processo).
 */
export function setEngineModeOverride(
  action: ReservaAction,
  mode: EngineMode | null,
): void {
  if (mode === null) {
    runtimeOverrides.delete(action);
    return;
  }
  runtimeOverrides.set(action, mode);
}

/** Override global em memória (todas as ações). `null` remove. */
export function setGlobalEngineModeOverride(mode: EngineMode | null): void {
  runtimeGlobalOverride = mode;
}

/** Remove todos os overrides em memória (volta a env → defaults D.6). */
export function clearEngineModeOverrides(): void {
  runtimeOverrides.clear();
  runtimeGlobalOverride = null;
}

/** Timeout (ms) da avaliação do Policy Engine em modo POLICY. */
export function getPolicyTimeoutMs(): number {
  const raw = Number(process.env.POLICY_ENGINE_POLICY_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_POLICY_TIMEOUT_MS;
}
