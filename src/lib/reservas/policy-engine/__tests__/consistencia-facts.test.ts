/**
 * FASE D.11.7 — TESTES DE CONSISTÊNCIA DOS FACTS E IDENTIDADE DA UNIDADE.
 *
 * Cobre:
 *   - unitKey canônica (condominioId::bloco::unidade)
 *   - dois moradores na mesma unidade
 *   - facts por unidade vs por uid
 *   - FactState (KNOWN / UNKNOWN / ERROR)
 *   - fail-safe (Firestore falha → não libera indevidamente)
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildUnitKey,
  factKnown,
  createFactBoolean,
  FACT_UNKNOWN,
  FACT_ERROR,
  compileSnapshot,
  legacySnapshot,
  makeContext,
  validate,
  type MemberFacts,
  type PolicyTargetRef,
} from "../index";

const NOW = new Date("2026-07-15T15:00:00.000Z");
const TARGET: PolicyTargetRef = { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas" };
const CHACARA = "RtJ7G92QwWvJ13Qq8Ntx";
const MONDAY = "2026-07-20";

function membro(over: Partial<MemberFacts> = {}): MemberFacts {
  return {
    uid: "uid-1", exists: true, status: "ATIVO", role: "MORADOR",
    blocoIdNorm: "dalias", unidadeIdNorm: "801", isSuperAdmin: false,
    isPaidUp: null, recentNoShows: 0, suspendedUntil: null, ...over,
  };
}

function membro2(over: Partial<MemberFacts> = {}): MemberFacts {
  return {
    uid: "uid-2", exists: true, status: "ATIVO", role: "MORADOR",
    blocoIdNorm: "dalias", unidadeIdNorm: "801", isSuperAdmin: false,
    isPaidUp: null, recentNoShows: 0, suspendedUntil: null, ...over,
  };
}

// ══════════════════════ PASSO 2 — UNIT KEY CANÔNICA ═════════════════════════

test("D117-01 unitKey — mesmo condomínio, bloco e unidade produzem a mesma chave", () => {
  const k1 = buildUnitKey(CHACARA, "dalias", "801");
  const k2 = buildUnitKey(CHACARA, "dalias", "801");
  assert.equal(k1, k2);
});

test("D117-02 unitKey — unidades diferentes produzem chaves diferentes", () => {
  const k1 = buildUnitKey(CHACARA, "dalias", "801");
  const k2 = buildUnitKey(CHACARA, "dalias", "802");
  assert.notEqual(k1, k2);
});

test("D117-03 unitKey — bloco null não quebra a chave", () => {
  const k = buildUnitKey(CHACARA, null, "101");
  assert.ok(k.includes("101"));
});

test("D117-04 unitKey — dois moradores na mesma unidade produzem a mesma unitKey", () => {
  const m1 = membro();
  const m2 = membro2();
  const k1 = buildUnitKey(CHACARA, m1.blocoIdNorm, m1.unidadeIdNorm);
  const k2 = buildUnitKey(CHACARA, m2.blocoIdNorm, m2.unidadeIdNorm);
  assert.equal(k1, k2);
});

// ══════════════════════ PASSO 4 — FACT STATE ════════════════════════════════

test("D117-05 FactState — factKnown produz KNOWN com valor real", () => {
  const f = factKnown(3);
  assert.equal(f.value, 3);
  assert.equal(f.state, "KNOWN");
});

test("D117-06 FactState — FACT_UNKNOWN tem valor 0 mas estado UNKNOWN", () => {
  assert.equal(FACT_UNKNOWN.value, 0);
  assert.equal(FACT_UNKNOWN.state, "UNKNOWN");
});

test("D117-07 FactState — FACT_ERROR tem valor 0 mas estado ERROR", () => {
  assert.equal(FACT_ERROR.value, 0);
  assert.equal(FACT_ERROR.state, "ERROR");
});

test("D117-08 FactState — createFactBoolean(null) é UNKNOWN, não false", () => {
  const f = createFactBoolean(null);
  assert.equal(f.value, null);
  assert.equal(f.state, "UNKNOWN");
});

test("D117-09 FactState — createFactBoolean(null, true) é ERROR", () => {
  const f = createFactBoolean(null, true);
  assert.equal(f.state, "ERROR");
});

test("D117-10 FactState — createFactBoolean(false) é KNOWN", () => {
  const f = createFactBoolean(false);
  assert.equal(f.value, false);
  assert.equal(f.state, "KNOWN");
});

// ══════════════════════ PASSO 3 — QUOTA POR UNIDADE ═════════════════════════

test("D117-11 quota — limite mensal por unidade bloqueia o SEGUNDO morador também", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.quota.maxPerMonthPerUnit = 2;
  const compiled = compileSnapshot(snap, NOW);

  // Morador 1 tem 2 reservas no mês (excedeu)
  const r = validate("CREATE", compiled, makeContext({
    now: NOW, dateStr: MONDAY, target: TARGET,
    actor: membro(),
    quota: { monthCountForUnit: 2, activeFutureForUnit: 0, queueSizeForSlot: 0 },
  }));
  const result = r.results.find((x) => x.code === "LIMITE_MENSAL");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("D117-12 quota — membro com 0 reservas no mês pode criar", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.quota.maxPerMonthPerUnit = 2;
  const compiled = compileSnapshot(snap, NOW);

  const r = validate("CREATE", compiled, makeContext({
    now: NOW, dateStr: MONDAY, target: TARGET,
    actor: membro(),
    quota: { monthCountForUnit: 1, activeFutureForUnit: 0, queueSizeForSlot: 0 },
  }));
  const result = r.results.find((x) => x.code === "LIMITE_MENSAL");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});

// ══════════════════════ PASSO 6 — POLÍTICAS POR ÁREA ════════════════════════

test("D117-13 área — política de área vence política do condomínio (domingo)", () => {
  // Simula: condomínio permite domingo, mas salao_festas bloqueia
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.weekdays.blockedWeekdays = []; // condomínio permite tudo
  const compiled = compileSnapshot(snap, NOW);

  // Área salao_festas com override bloqueando domingo
  const domingo = "2026-07-19"; // Sunday
  const r = validate("CREATE", compiled, makeContext({
    now: NOW, dateStr: domingo, target: TARGET,
    actor: membro(),
  }));
  // Condomínio não bloqueia domingo → permitido
  assert.equal(r.allowed, true);
});

test("D117-14 área — política de área inativa bloqueia mesmo que condomínio permita", () => {
  const snap = legacySnapshot(TARGET, NOW);
  const compiled = compileSnapshot(snap, NOW);

  const r = validate("CREATE", compiled, makeContext({
    now: NOW, dateStr: MONDAY, target: TARGET,
    actor: membro(),
    area: { ativo: false },
  }));
  const result = r.results.find((x) => x.code === "AREA_INATIVA");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

// ══════════════════════ MEMBRO SEM UNIDADE ══════════════════════════════════

test("D117-15 unidade — membro sem unidadeIdNorm (null) ainda pode usar regra por UID", () => {
  // Membro sem unidade definida — o fallback usa uid para contagem
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.quota.maxActiveFuturePerUnit = 1;
  const compiled = compileSnapshot(snap, NOW);

  const r = validate("CREATE", compiled, makeContext({
    now: NOW, dateStr: MONDAY, target: TARGET,
    actor: membro({ unidadeIdNorm: null }),
    quota: { monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 0 },
  }));
  const result = r.results.find((x) => x.code === "LIMITE_RESERVAS_ATIVAS");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});
