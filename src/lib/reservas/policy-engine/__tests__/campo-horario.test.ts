/**
 * FASE 16.5.2 — TESTES R0.1: CAMPO_FORA_HORARIO COM INTERVALOS EM MINUTOS.
 *
 * Cobre:
 *   CH01–CH06 — Policy resolution (inalterado).
 *   R01–R17   — Regra com intervalo solicitado (NOVO).
 *   MC01–MC04 — Multi-condomínio (inalterado).
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

/** Valida CAMPO_REGISTRAR com intervalo solicitado em minutos. */
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

function assertRule(result: any, outcome: string) {
  const r = result.results.find((r: any) => r.code === "CAMPO_FORA_HORARIO");
  assert.ok(r, "CAMPO_FORA_HORARIO rule result expected");
  assert.equal(r!.outcome, outcome, `Expected ${outcome}, got ${r!.outcome}: ${r!.message}`);
  return r;
}

// ═══════════════════════════ CH — POLICY RESOLUTION ═══════════════════════════

test("CH01 DEFAULT_POLICY — campo é neutro (null/null)", () => {
  assert.equal(DEFAULT_POLICY.campo.horaInicio, null);
  assert.equal(DEFAULT_POLICY.campo.horaFim, null);
});

test("CH02 DEFAULT_POLICY — exceção desabilitada, horaFim null (neutro)", () => {
  assert.equal(DEFAULT_POLICY.campo.excecaoHorarioEstendido.habilitada, false);
  assert.equal(DEFAULT_POLICY.campo.excecaoHorarioEstendido.horaFim, null);
});

test("CH03 LEGACY_POLICY_CHACARA_ITAGUAI — campo definido (06–22)", () => {
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.campo.horaInicio, 6);
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.campo.horaFim, 22);
});

test("CH04 LEGACY_POLICY_CHACARA_ITAGUAI — exceção desabilitada", () => {
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.campo.excecaoHorarioEstendido.habilitada, false);
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.campo.excecaoHorarioEstendido.horaFim, 23);
});

test("CH05 resolver — condomínio sem registro recebe campo null (DEFAULT)", async () => {
  const repo = repoWithCondo("condo-novo-999");
  const resolved = await resolvePolicy(repo, { condominioId: "condo-novo-999", areaId: "quadra" }, NOW);
  assert.equal(resolved.policy.campo.horaInicio, null);
  assert.equal(resolved.policy.campo.horaFim, null);
});

test("CH06 resolver — Chácara recebe campo 06–22 do LEGACY", async () => {
  const repo = repoWithCondo(CHACARA_ID);
  const resolved = await resolvePolicy(repo, TARGET, NOW);
  assert.equal(resolved.policy.campo.horaInicio, 6);
  assert.equal(resolved.policy.campo.horaFim, 22);
});

// ═══════════════════════════ R — REGRA COM INTERVALO ══════════════════════════

test("R01 Chácara 06:00–07:00 → PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("06:00"), hhmmToMin("07:00")), "PASS");
});

test("R02 Chácara 05:59–07:00 → FAIL (antes de 06:00)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("05:59"), hhmmToMin("07:00")), "FAIL");
});

test("R03 Chácara 21:00–22:00 → PASS (22:00 é fim válido)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("21:00"), hhmmToMin("22:00")), "PASS");
});

test("R04 Chácara 21:00–22:01 → FAIL (após 22:00)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("21:00"), hhmmToMin("22:01")), "FAIL");
});

test("R05 Chácara 15:20–16:40 → PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("15:20"), hhmmToMin("16:40")), "PASS");
});

test("R06 Chácara 20:00–19:00 → FAIL (início > fim)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("19:00")), "FAIL");
});

test("R07 Chácara 18:00–18:00 → FAIL (início == fim)", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("18:00"), hhmmToMin("18:00")), "FAIL");
});

test("R08 Chácara exceção desabilitada: 22:00–22:30 → FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.campo.excecaoHorarioEstendido.habilitada = false;
  assertRule(validaCampo(snap, hhmmToMin("22:00"), hhmmToMin("22:30")), "FAIL");
});

test("R09 Chácara exceção habilitada: 22:00–22:30 → PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.campo.excecaoHorarioEstendido.habilitada = true;
  assertRule(validaCampo(snap, hhmmToMin("22:00"), hhmmToMin("22:30")), "PASS");
});

test("R10 Chácara exceção habilitada: 22:00–23:00 → PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.campo.excecaoHorarioEstendido.habilitada = true;
  assertRule(validaCampo(snap, hhmmToMin("22:00"), hhmmToMin("23:00")), "PASS");
});

test("R11 Chácara exceção habilitada: 22:00–23:01 → FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.campo.excecaoHorarioEstendido.habilitada = true;
  assertRule(validaCampo(snap, hhmmToMin("22:00"), hhmmToMin("23:01")), "FAIL");
});

test("R12 Condo B (07–21): 20:00–21:00 → PASS", () => {
  const snap = legacySnapshot({ condominioId: "condo-b", areaId: "quadra" }, NOW);
  snap.policy.campo.horaInicio = 7;
  snap.policy.campo.horaFim = 21;
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("21:00"), { condominioId: "condo-b", areaId: "quadra" }), "PASS");
});

test("R13 Condo B (07–21): 20:00–21:01 → FAIL", () => {
  const snap = legacySnapshot({ condominioId: "condo-b", areaId: "quadra" }, NOW);
  snap.policy.campo.horaInicio = 7;
  snap.policy.campo.horaFim = 21;
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("21:01"), { condominioId: "condo-b", areaId: "quadra" }), "FAIL");
});

test("R14 Condo sem configuração → SKIP", () => {
  const snap = legacySnapshot({ condominioId: "condo-c", areaId: "quadra" }, NOW);
  const result = validaCampo(snap, hhmmToMin("10:00"), hhmmToMin("11:00"), { condominioId: "condo-c", areaId: "quadra" });
  const r = assertRule(result, "SKIP");
  assert.equal(result.allowed, true);
});

test("R15 Chácara configurada mas sem intervalo no contexto → FAIL fechado", () => {
  const snap = legacySnapshot(TARGET, NOW);
  const ms = Date.UTC(2026, 6, 15, 14, 0, 0, 0);
  const compiled = compileSnapshot(snap, new Date(ms));
  const ctx = makeContext({
    now: new Date(ms),
    dateStr: "2026-07-15",
    target: TARGET,
    actor: ACTOR,
    // campoInicioMin/campoFimMin propositalmente ausentes
  });
  const result = validate("CAMPO_REGISTRAR", compiled, ctx);
  assertRule(result, "FAIL");
});

test("R16 CREATE de reserva privativa NÃO executa CAMPO_FORA_HORARIO", () => {
  const snap = legacySnapshot(TARGET, NOW);
  const ms = Date.UTC(2026, 6, 15, 23, 0, 0, 0);
  const compiled = compileSnapshot(snap, new Date(ms));
  const ctx = makeContext({
    now: new Date(ms),
    dateStr: "2026-07-15",
    target: TARGET,
    actor: ACTOR,
  });
  const result = validate("CREATE", compiled, ctx);
  const campoRule = result.results.find(r => r.code === "CAMPO_FORA_HORARIO");
  assert.equal(campoRule, undefined, "CAMPO_FORA_HORARIO should not run for CREATE");
});

test("R17 intervalo futuro válido independente do horário atual", () => {
  const snap = legacySnapshot(TARGET, NOW);
  // Simula que AGORA são 14:00, mas o intervalo solicitado é 20:00–21:00
  // O resultado deve depender do intervalo (20:00–21:00), não do currentHour (14:00)
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("21:00")), "PASS");
  // Intervalo 23:00–23:30 deve falhar, mesmo que currentHour seja 14:00
  assertRule(validaCampo(snap, hhmmToMin("23:00"), hhmmToMin("23:30")), "FAIL");
});

// ═══════════════════════════ MC — MULTI-CONDOMÍNIO ════════════════════════════

test("MC01 Chácara vs Condo B: políticas independentes", async () => {
  const repoA = repoWithCondo(CHACARA_ID);
  const repoB = repoWithCondo("condo-b", {
    condominioPolicy: { campo: { horaInicio: 7, horaFim: 21 } } as any,
  });

  const [resA, resB] = await Promise.all([
    resolvePolicy(repoA, TARGET, NOW),
    resolvePolicy(repoB, { condominioId: "condo-b", areaId: "quadra" }, NOW),
  ]);

  assert.equal(resA.policy.campo.horaInicio, 6);
  assert.equal(resA.policy.campo.horaFim, 22);
  assert.equal(resB.policy.campo.horaInicio, 7);
  assert.equal(resB.policy.campo.horaFim, 21);
});

test("MC02 condomínio novo NÃO herda 06 da Chácara", async () => {
  const repo = repoWithCondo("condo-c-novo");
  const resolved = await resolvePolicy(repo, { condominioId: "condo-c-novo", areaId: "quadra" }, NOW);
  assert.notEqual(resolved.policy.campo.horaInicio, 6);
  assert.equal(resolved.policy.campo.horaInicio, null);
});

test("MC03 condomínio novo NÃO herda 22 da Chácara", async () => {
  const repo = repoWithCondo("condo-d-novo");
  const resolved = await resolvePolicy(repo, { condominioId: "condo-d-novo", areaId: "quadra" }, NOW);
  assert.notEqual(resolved.policy.campo.horaFim, 22);
  assert.equal(resolved.policy.campo.horaFim, null);
});

test("MC04 RESERVA_CREATE NÃO dispara CAMPO_FORA_HORARIO", () => {
  const snap = legacySnapshot(TARGET, NOW);
  const ms = Date.UTC(2026, 6, 15, 23, 0, 0, 0);
  const compiled = compileSnapshot(snap, new Date(ms));
  const ctx = makeContext({
    now: new Date(ms),
    dateStr: "2026-07-15",
    target: TARGET,
    actor: ACTOR,
  });
  const result = validate("CREATE", compiled, ctx);
  const campoRule = result.results.find(r => r.code === "CAMPO_FORA_HORARIO");
  assert.equal(campoRule, undefined, "CAMPO_FORA_HORARIO should not apply to RESERVA_PRIVATIVA");
});

// ══════════════════════════ R02 — NEUTRALIDADE DEFAULT ════════════════════════

test("R02-01 DEFAULT_POLICY: excecao.horaFim === null", () => {
  assert.equal(DEFAULT_POLICY.campo.excecaoHorarioEstendido.horaFim, null);
});

test("R02-02 condomínio novo sem config → SKIP", () => {
  const snap = legacySnapshot({ condominioId: "condo-sem-config", areaId: "quadra" }, NOW);
  const result = validaCampo(snap, hhmmToMin("10:00"), hhmmToMin("11:00"), { condominioId: "condo-sem-config", areaId: "quadra" });
  assertRule(result, "SKIP");
});

test("R02-03 condomínio novo NÃO herda 23h da Chácara", async () => {
  const repo = repoWithCondo("condo-sem-chacara");
  const resolved = await resolvePolicy(repo, { condominioId: "condo-sem-chacara", areaId: "quadra" }, NOW);
  assert.equal(resolved.policy.campo.excecaoHorarioEstendido.horaFim, null);
  assert.notEqual(resolved.policy.campo.excecaoHorarioEstendido.horaFim, 23);
});

test("R02-04 Chácara exceção desabilitada: 22:00–22:30 → FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  assertRule(validaCampo(snap, hhmmToMin("22:00"), hhmmToMin("22:30")), "FAIL");
});

test("R02-05 Chácara exceção habilitada: 22:00–23:00 → PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.campo.excecaoHorarioEstendido.habilitada = true;
  assertRule(validaCampo(snap, hhmmToMin("22:00"), hhmmToMin("23:00")), "PASS");
});

test("R02-06 Chácara exceção habilitada: 22:00–23:01 → FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.campo.excecaoHorarioEstendido.habilitada = true;
  assertRule(validaCampo(snap, hhmmToMin("22:00"), hhmmToMin("23:01")), "FAIL");
});

test("R02-07 policy com habilitada=true mas horaFim=null → usa campo.horaFim", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.campo.excecaoHorarioEstendido.habilitada = true;
  snap.policy.campo.excecaoHorarioEstendido.horaFim = null;
  // Com horaFim=null e habilitada=true, deve usar campo.horaFim (22)
  // 22:00–22:30 → FAIL (após 22:00)
  assertRule(validaCampo(snap, hhmmToMin("22:00"), hhmmToMin("22:30")), "FAIL");
});

test("R02-08 Condo B exceção habilitada com horaFim=21: 20:00–21:00 → PASS", () => {
  const snap = legacySnapshot({ condominioId: "condo-b", areaId: "quadra" }, NOW);
  snap.policy.campo.horaInicio = 7;
  snap.policy.campo.horaFim = 22;
  snap.policy.campo.excecaoHorarioEstendido.habilitada = true;
  snap.policy.campo.excecaoHorarioEstendido.horaFim = 21;
  // Exceção encurta para 21h: 20:00–21:00 → PASS
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("21:00"), { condominioId: "condo-b", areaId: "quadra" }), "PASS");
  // 20:00–22:00 → FAIL (após 21:00)
  assertRule(validaCampo(snap, hhmmToMin("20:00"), hhmmToMin("22:00"), { condominioId: "condo-b", areaId: "quadra" }), "FAIL");
});
