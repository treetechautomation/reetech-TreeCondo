/**
 * FASE D.3 — POLICY ENGINE — FACHADA PÚBLICA.
 *
 * ÚNICA superfície de import para consumidores do engine (D.4/D.5).
 * Exceção deliberada: os adapters NÃO são reexportados aqui para não arrastar
 * SDKs do Firebase para o bundle errado — importe-os diretamente:
 *   - server: "@/lib/reservas/policy-engine/adapters/admin"
 *   - client: "@/lib/reservas/policy-engine/adapters/web"
 *
 * Nesta fase o engine está ISOLADO: nenhuma API, hook ou página o consome.
 */

import type {
  CompiledPolicy,
  ISODate,
  PolicyContext,
  PolicyRepository,
  PolicyTargetRef,
  ReservaLike,
} from "./types";
import { resolvePolicy } from "./resolver";
import { compilePolicy, compileSnapshot } from "./compiler";
import { getSnapshotForReserva } from "./snapshots";

// ── Núcleo ───────────────────────────────────────────────────────────────────
export { resolvePolicy, mergePolicyLayers } from "./resolver";
export { compilePolicy, compileSnapshot } from "./compiler";
export { validate, explain } from "./validator";
export { buildSnapshot, legacySnapshot, getSnapshotForReserva } from "./snapshots";
export { RULE_CATALOG, rulesForAction, getRuleDescriptor } from "./catalog";
export { DEFAULT_POLICY, LEGACY_POLICY_CHACARA_ITAGUAI, LEGACY_POLICY_REGISTRY, getLegacyPolicyForCondominio } from "./defaults";
export { createCachedPolicyRepository } from "./repository";
export {
  LEGACY_POLICY_VERSION,
  ENGINE_SCHEMA_VERSION,
  policyHash,
  isLegacyVersion,
} from "./versioning";

// ── D.11.7 — Fact State + Unit Key ──────────────────────────────────────────
export { buildUnitKey, factKnown, createFactBoolean, FACT_UNKNOWN, FACT_ERROR } from "./types";

// ── Regulamento (D.8 — contratos) ─────────────────────────────────────────────
export type { RegulamentoService } from "./regulamento";
export { HerancaUtils } from "./regulamento";

// ── Regulamento Admin (D.9 — CRUD + ciclo de vida) ────────────────────────────
export type { RegulamentoRepository } from "./regulamento-repository";
export { createRegulamentoAdminService } from "./regulamento-admin";
export type { RegulamentoAdminService } from "./regulamento-admin";

// ── Tipos ────────────────────────────────────────────────────────────────────
export type * from "./types";

// ── Conveniências de alto nível ──────────────────────────────────────────────

/** Resolve + compila em um passo (fluxo Firestore → Resolver → Compiler → Runtime). */
export async function getCompiledPolicy(
  repo: PolicyRepository,
  target: PolicyTargetRef,
  now: Date = new Date()
): Promise<CompiledPolicy> {
  return compilePolicy(await resolvePolicy(repo, target, now), now);
}

/**
 * Política aplicável a uma reserva EXISTENTE:
 * snapshot congelado quando houver; senão política legada v0 (compat total).
 */
export function getPolicyForReserva(reserva: ReservaLike, now: Date = new Date()): CompiledPolicy {
  return compileSnapshot(getSnapshotForReserva(reserva, now), now);
}

/** Data civil de hoje em America/Sao_Paulo — paridade com todayInSaoPaulo() do motor congelado. */
export function todaySaoPauloISO(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Construtor de contexto com defaults seguros — reduz boilerplate dos
 * chamadores (D.4) e dos testes. Todo I/O já deve ter acontecido antes.
 */
export function makeContext(
  input: Partial<PolicyContext> &
    Pick<PolicyContext, "dateStr" | "target"> & { now?: Date }
): PolicyContext {
  const now = input.now ?? new Date();
  return {
    nowMs: input.nowMs ?? now.getTime(),
    today: input.today ?? todaySaoPauloISO(now),
    dateStr: input.dateStr,
    target: input.target,
    actor:
      input.actor ??
      ({
        uid: "",
        exists: false,
        status: "",
        role: "",
        blocoIdNorm: null,
        unidadeIdNorm: null,
        isSuperAdmin: false,
        isPaidUp: null,
        recentNoShows: 0,
        suspendedUntil: null,
      } as PolicyContext["actor"]),
    area: input.area ?? { ativo: true },
    quota:
      input.quota ?? { monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 0 },
    priceCentavos: input.priceCentavos ?? 0,
    isOperatorAction: input.isOperatorAction ?? false,
    ...(input.reserva !== undefined ? { reserva: input.reserva } : {}),
    ...(input.offer !== undefined ? { offer: input.offer } : {}),
    ...(input.guestCount !== undefined ? { guestCount: input.guestCount } : {}),
    ...(input.checkinCompleted !== undefined ? { checkinCompleted: input.checkinCompleted } : {}),
    ...(input.campoInicioMin !== undefined ? { campoInicioMin: input.campoInicioMin } : {}),
    ...(input.campoFimMin !== undefined ? { campoFimMin: input.campoFimMin } : {}),
  };
}
