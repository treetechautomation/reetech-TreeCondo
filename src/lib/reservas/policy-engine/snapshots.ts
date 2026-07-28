/**
 * FASE D.3 — POLICY ENGINE — SNAPSHOTS.
 *
 * Congela a política resolvida na reserva (policyVersion + policySnapshot):
 * reserva antiga NUNCA muda de regra quando o regulamento é alterado.
 *
 * FASE D.8: Multi-condomínio.
 *   - legacySnapshot usa LEGACY_POLICY (Chácara Itaguaí), NÃO DEFAULT_POLICY.
 *   - DEFAULT_POLICY é neutro — condomínios novos sem regulamento publicado
 *     herdam permissividade, não as regras da Chácara.
 *   - Snapshots agora incluem condominioId para rastreabilidade completa.
 */

import type { PolicySnapshot, PolicyTargetRef, ReservaLike, ResolvedPolicy } from "./types";
import { DEFAULT_POLICY, getLegacyPolicyForCondominio } from "./defaults";
import { ENGINE_SCHEMA_VERSION, LEGACY_POLICY_VERSION, policyHash } from "./versioning";

export function buildSnapshot(resolved: ResolvedPolicy, now: Date = new Date()): PolicySnapshot {
  return {
    policyVersion: resolved.version,
    policyHash: policyHash(resolved.policy),
    policy: resolved.policy,
    target: resolved.target,
    condominioId: resolved.target.condominioId,
    frozenAt: now.toISOString(),
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
  };
}

/**
 * Snapshot legado v0 para reservas sem política congelada.
 *
 * FASE D.8.1 (P0 ARCH): a política legada aplicada depende do condominioId.
 * Somente condomínios no LEGACY_POLICY_REGISTRY recebem sua política específica.
 * Os demais recebem DEFAULT_POLICY (compatibilidade neutra).
 */
export function legacySnapshot(target: PolicyTargetRef, now: Date = new Date()): PolicySnapshot {
  const legacy = getLegacyPolicyForCondominio(target.condominioId);
  // structuredClone: testes podem mutar snap.policy sem corromper a constante global.
  const policy = structuredClone(legacy ?? DEFAULT_POLICY);
  return {
    policyVersion: LEGACY_POLICY_VERSION,
    policyHash: policyHash(policy),
    policy,
    target,
    condominioId: target.condominioId,
    frozenAt: now.toISOString(),
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
  };
}

/**
 * Recupera o snapshot aplicável a uma reserva:
 *  - com policySnapshot ⇒ usa o congelado (imutabilidade histórica);
 *  - sem (todas as reservas atuais) ⇒ fallback legado v0.
 */
export function getSnapshotForReserva(reserva: ReservaLike, now: Date = new Date()): PolicySnapshot {
  const snap = reserva.policySnapshot;
  if (snap && snap.policy && Number.isFinite(Number(snap.policyVersion))) {
    return snap;
  }
  return legacySnapshot(
    {
      condominioId: String(reserva.condominioId || ""),
      areaId: String(reserva.areaId || ""),
      ...(reserva.opcaoId ? { opcaoId: String(reserva.opcaoId) } : {}),
    },
    now
  );
}
