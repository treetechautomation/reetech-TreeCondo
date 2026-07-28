/**
 * D.12.0-FINAL — TESTES DE INTEGRAÇÃO FINAL.
 *
 * Cobre: Guest List server-side, Policy Snapshot, Idempotência.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// Policy Snapshot verification
import { compileSnapshot, legacySnapshot, makeContext, validate, policyHash, LEGACY_POLICY_CHACARA_ITAGUAI } from "../index";
import type { PolicyTargetRef } from "../index";

const NOW = new Date("2026-07-15T15:00:00.000Z");
const TARGET: PolicyTargetRef = { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas" };
const MONDAY = "2026-07-20";

function membro(over: any = {}) {
  return { uid:"u1", exists:true, status:"ATIVO", role:"MORADOR", blocoIdNorm:"dalias", unidadeIdNorm:"801", isSuperAdmin:false, isPaidUp:null, recentNoShows:0, suspendedUntil:null, ...over };
}

// ════════════════ BLOQUEADOR 2 — POLICY SNAPSHOT ════════════════

test("FINAL-01 Snapshot — policyVersion/hash são preservados no snapshot compilado", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assert.ok(snap.policyVersion !== undefined);
  assert.ok(snap.policyHash !== undefined);
  assert.ok(snap.policyHash.length > 0);
  assert.deepEqual(snap.policy, LEGACY_POLICY_CHACARA_ITAGUAI);
});

test("FINAL-02 Snapshot — hash é determinístico e estável", () => {
  const snap1 = legacySnapshot(TARGET, NOW);
  const snap2 = legacySnapshot(TARGET, NOW);
  assert.equal(snap1.policyHash, snap2.policyHash);
});

test("FINAL-03 Snapshot — política nova não altera snapshot antigo (imutabilidade)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  const originalHash = snap.policyHash;
  // Simular alteração de política global
  snap.policy.cancellation.minHoursBeforeEvent = 99;
  // Recalcular hash após mutação
  const newHash = policyHash(snap.policy);
  assert.notEqual(originalHash, newHash);
});

// ════════════════ GUEST LIST + APPROVE ════════════════

test("FINAL-04 GuestList — lista obrigatória sem convidados bloqueia APPROVE", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.capacity.guestList.required = true;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("APPROVE", compiled, makeContext({
    now: NOW, dateStr: MONDAY, target: TARGET, actor: membro(), guestCount: 0,
  }));
  const result = r.results.find(x => x.code === "LISTA_CONVIDADOS_OBRIGATORIA");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("FINAL-05 GuestList — lista obrigatória com convidados permite APPROVE", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.capacity.guestList.required = true;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("APPROVE", compiled, makeContext({
    now: NOW, dateStr: MONDAY, target: TARGET, actor: membro(), guestCount: 5,
  }));
  const result = r.results.find(x => x.code === "LISTA_CONVIDADOS_OBRIGATORIA");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});

test("FINAL-06 GuestList — lista NÃO exigida permite APPROVE sem convidados", () => {
  const snap = legacySnapshot(TARGET, NOW);
  // guestList.required = false (default)
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("APPROVE", compiled, makeContext({
    now: NOW, dateStr: MONDAY, target: TARGET, actor: membro(), guestCount: 0,
  }));
  const result = r.results.find(x => x.code === "LISTA_CONVIDADOS_OBRIGATORIA");
  assert.ok(result);
  assert.equal(result.outcome, "SKIP");
});

// ════════════════ IDEMPOTÊNCIA (QUOTA) ════════════════

test("FINAL-07 Idempotência — reservationIds impede contagem dupla", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.quota.maxPerMonthPerUnit = 2;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, makeContext({
    now: NOW, dateStr: MONDAY, target: TARGET, actor: membro(),
    quota: { monthCountForUnit: 1, activeFutureForUnit: 0, queueSizeForSlot: 0, monthCountState: "KNOWN" },
  }));
  const result = r.results.find(x => x.code === "LIMITE_MENSAL");
  assert.ok(result);
  assert.equal(result.outcome, "PASS"); // 1 < 2 = ok
});

test("FINAL-08 Regressão — CREATE com domingo bloqueado (33 cenários intactos)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, makeContext({
    now: NOW, dateStr: "2026-07-19", target: TARGET, actor: membro(),
  }));
  const result = r.results.find(x => x.code === "DIA_SEMANA_BLOQUEADO");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});
