/**
 * FASE 16.6 / R1 — TESTES DE INTEGRAÇÃO POLICY/API DO CAMPO.
 *
 * Valida cenários de registro + cancelamento contra o Policy Engine.
 * NÃO usa Firebase emulator — são testes de contrato da regra com contexto real.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_POLICY,
  LEGACY_POLICY_CHACARA_ITAGUAI,
  getLegacyPolicyForCondominio,
  resolvePolicy,
  validate,
  compileSnapshot,
  legacySnapshot,
  makeContext,
  type PolicyRepository,
} from "../index";

const CHACARA_ID = "RtJ7G92QwWvJ13Qq8Ntx";
const TARGET = { condominioId: CHACARA_ID, areaId: "quadra" };
const NOW = new Date("2026-07-15T15:00:00.000Z");

function repoWithCondo(cid: string, overrides?: Partial<Record<string, any>>): PolicyRepository {
  return {
    getPublishedVersion: async () => ({ version: 0, publishedAt: null }),
    getCondominioPolicy: async () => (overrides?.condominioPolicy ?? null),
    getAreaPolicy: async () => (overrides?.areaPolicy ?? null),
    getOpcaoPolicy: async () => null,
    getMemberFacts: async () => ({
      uid: "u1", exists: true, status: "ATIVO", role: "MORADOR",
      blocoIdNorm: null, unidadeIdNorm: null, isSuperAdmin: false,
      isPaidUp: null, recentNoShows: 0, suspendedUntil: null,
    }),
    getQuotaFacts: async () => ({
      monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 0,
    }),
  };
}

const ACTOR = {
  uid: "u1", exists: true, status: "ATIVO", role: "MORADOR",
  blocoIdNorm: null, unidadeIdNorm: null, isSuperAdmin: false,
  isPaidUp: null, recentNoShows: 0, suspendedUntil: null,
} as const;

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function validaCampo(snap: any, inicioMin: number, fimMin: number, target = TARGET) {
  const ms = Date.UTC(2026, 6, 15, 14, 0, 0, 0);
  const compiled = compileSnapshot(snap, new Date(ms));
  const ctx = makeContext({
    now: new Date(ms),
    dateStr: "2026-07-15",
    target,
    actor: ACTOR,
    campoInicioMin: inicioMin,
    campoFimMin: fimMin,
  });
  return validate("CAMPO_REGISTRAR", compiled, ctx);
}

function assertRule(result: any, outcome: string, msg?: string) {
  const r = result.results.find((r: any) => r.code === "CAMPO_FORA_HORARIO");
  assert.ok(r, msg ?? "CAMPO_FORA_HORARIO rule result expected");
  assert.equal(r!.outcome, outcome, `Expected ${outcome}, got ${r!.outcome}: ${r!.message}`);
}

// ═══════════════════════════ R1 REGISTRATION SCENARIOS ════════════════════════

test("R1-T01 Chácara — intervalo 06:00–07:00 → PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("06:00"), hhmmToMin("07:00")), "PASS");
});

test("R1-T02 Chácara — intervalo 21:00–22:01 → FAIL (ultrapassa 22h)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("21:00"), hhmmToMin("22:01")), "FAIL");
});

test("R1-T03 Chácara exceção habilitada — 22:00–23:00 → PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.campo.excecaoHorarioEstendido.habilitada = true;
  assertRule(validaCampo(snap, hhmmToMin("22:00"), hhmmToMin("23:00")), "PASS");
});

test("R1-T04 condomínio sem config → não herda Chácara → SKIP", () => {
  const snap = legacySnapshot({ condominioId: "condo-novo", areaId: "quadra" }, NOW);
  const r = assertRule(validaCampo(snap, hhmmToMin("10:00"), hhmmToMin("11:00"), { condominioId: "condo-novo", areaId: "quadra" }), "SKIP");
  assert.equal(validaCampo(snap, hhmmToMin("10:00"), hhmmToMin("11:00"), { condominioId: "condo-novo", areaId: "quadra" }).allowed, true);
});

test("R1-T05 Condo B 07–21: 20:00–21:01 → FAIL", () => {
  const snap = legacySnapshot({ condominioId: "condo-b", areaId: "quadra" }, NOW);
  snap.policy.campo.horaInicio = 7;
  snap.policy.campo.horaFim = 21;
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("21:01"), { condominioId: "condo-b", areaId: "quadra" }), "FAIL");
});

test("R1-T06 intervalo válido → PASS (registro permitido)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  const result = validaCampo(snap, hhmmToMin("15:00"), hhmmToMin("18:00"));
  assert.equal(result.allowed, true);
  assertRule(result, "PASS");
});

test("R1-T07 mesmo UID, 2 períodos sobrepostos → ambos PASS (sem bloqueio)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  const r1 = validaCampo(snap, hhmmToMin("15:00"), hhmmToMin("18:00"));
  const r2 = validaCampo(snap, hhmmToMin("16:00"), hhmmToMin("19:00"));
  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
});

test("R1-T10 Chácara 21:00–22:00 → permitted (22:00 fim válido)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("21:00"), hhmmToMin("22:00")), "PASS");
});

test("R1-T11 Condo B 07–21: 20:00–21:00 → PASS (21:00 fim válido)", () => {
  const snap = legacySnapshot({ condominioId: "condo-b", areaId: "quadra" }, NOW);
  snap.policy.campo.horaInicio = 7;
  snap.policy.campo.horaFim = 21;
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("21:00"), { condominioId: "condo-b", areaId: "quadra" }), "PASS");
});

test("R1-T13 dois moradores com períodos sobrepostos → ambos PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  // Simulate two different contexts (different UIDs via makeContext)
  const ms = Date.UTC(2026, 6, 15, 14, 0, 0, 0);
  const compiled = compileSnapshot(snap, new Date(ms));
  const ctxA = makeContext({
    now: new Date(ms), dateStr: "2026-07-15", target: TARGET,
    actor: { ...ACTOR, uid: "moradorA" },
    campoInicioMin: hhmmToMin("15:00"), campoFimMin: hhmmToMin("18:00"),
  });
  const ctxB = makeContext({
    now: new Date(ms), dateStr: "2026-07-15", target: TARGET,
    actor: { ...ACTOR, uid: "moradorB" },
    campoInicioMin: hhmmToMin("16:00"), campoFimMin: hhmmToMin("19:00"),
  });
  assert.equal(validate("CAMPO_REGISTRAR", compiled, ctxA).allowed, true);
  assert.equal(validate("CAMPO_REGISTRAR", compiled, ctxB).allowed, true);
});

test("R1-T15 inicio == fim → FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("18:00"), hhmmToMin("18:00")), "FAIL");
});

test("R1-T16 inicio > fim → FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("19:00")), "FAIL");
});

test("R1-T17 intervalo ultrapassa horaFim → FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("22:30")), "FAIL");
});

test("R1-T20 condomínio sem config Campo → não herda Chácara → SKIP", async () => {
  const repo = repoWithCondo("condo-sem-campo");
  const resolved = await resolvePolicy(repo, { condominioId: "condo-sem-campo", areaId: "quadra" }, NOW);
  assert.equal(resolved.policy.campo.horaInicio, null);
  assert.equal(resolved.policy.campo.horaFim, null);
  // Chácara manter seus valores
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.campo.horaInicio, 6);
});

// ═══════════════════════════ R0/R0.1 REGRESSION ═══════════════════════════════

test("R1-REGR-01 CAMPO_REGISTRAR action exists", () => {
  const compiled = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const ctx = makeContext({
    now: NOW, dateStr: "2026-07-15", target: TARGET, actor: ACTOR,
    campoInicioMin: 360, campoFimMin: 420,
  });
  // CAMPO_REGISTRAR must be a valid action for validate()
  const result = validate("CAMPO_REGISTRAR", compiled, ctx);
  assert.ok(result, "validate should accept CAMPO_REGISTRAR");
});

test("R1-REGR-02 CAMPO_FORA_HORARIO uses interval, not currentHour", () => {
  const snap = legacySnapshot(TARGET, NOW);
  // Intervalo 23:00–23:30 → deve FAIL mesmo com currentHour = 14:00
  const result = validaCampo(snap, hhmmToMin("23:00"), hhmmToMin("23:30"));
  assertRule(result, "FAIL");
});

test("R1-REGR-03 DEFAULT_POLICY permanece neutro", () => {
  assert.equal(DEFAULT_POLICY.campo.horaInicio, null);
  assert.equal(DEFAULT_POLICY.campo.horaFim, null);
});

test("R1-REGR-04 private reservation (CREATE) unaffected", () => {
  const snap = legacySnapshot(TARGET, NOW);
  const compiled = compileSnapshot(snap, NOW);
  const ctx = makeContext({ now: NOW, dateStr: "2026-07-15", target: TARGET, actor: ACTOR });
  const result = validate("CREATE", compiled, ctx);
  const campoRule = result.results.find(r => r.code === "CAMPO_FORA_HORARIO");
  assert.equal(campoRule, undefined, "CAMPO_FORA_HORARIO must not run for CREATE");
});
