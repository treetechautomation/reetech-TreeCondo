/**
 * FASE D.3 — POLICY ENGINE — COMPILER (ajuste obrigatório D.3 §6).
 *
 * Fluxo: Firestore → Resolver → COMPILER → Runtime Policy → Validator.
 *
 * O merge hierárquico acontece UMA única vez (no resolver); o compiler
 * congela o resultado em uma estrutura de runtime imutável, com índices
 * pré-computados (Sets) para avaliação O(1). O Validator trabalha sempre
 * sobre a política compilada — nunca sobre parciais.
 */

import type { CompiledPolicy, PolicySnapshot, ResolvedPolicy } from "./types";
import { policyHash } from "./versioning";

const FULL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_DAY_RE = /^\d{2}-\d{2}$/;

export function compilePolicy(resolved: ResolvedPolicy, now: Date = new Date()): CompiledPolicy {
  const { policy } = resolved;

  const blockedCustomFull = new Set<string>();
  const blockedCustomMonthDay = new Set<string>();
  for (const c of policy.holidays.custom) {
    if (c.mode !== "BLOCK") continue;
    if (FULL_DATE_RE.test(c.date)) blockedCustomFull.add(c.date);
    else if (MONTH_DAY_RE.test(c.date)) blockedCustomMonthDay.add(c.date);
  }

  return Object.freeze({
    policy,
    version: resolved.version,
    target: resolved.target,
    provenance: resolved.provenance,
    compiledAt: now.toISOString(),
    hash: policyHash(policy),
    blockedWeekdaySet: new Set(policy.weekdays.blockedWeekdays),
    blockedFixedDateSet: new Set(policy.holidays.mode === "BLOCK" ? policy.holidays.fixedDates : []),
    blockedCustomFullDateSet: blockedCustomFull,
    blockedCustomMonthDaySet: blockedCustomMonthDay,
  });
}

/** Compila a partir de um snapshot congelado (reserva existente ou legado v0). */
export function compileSnapshot(snapshot: PolicySnapshot, now: Date = new Date()): CompiledPolicy {
  return compilePolicy(
    {
      policy: snapshot.policy,
      version: snapshot.policyVersion,
      target: snapshot.target,
      provenance: {},
      resolvedAt: snapshot.frozenAt,
    },
    now
  );
}
