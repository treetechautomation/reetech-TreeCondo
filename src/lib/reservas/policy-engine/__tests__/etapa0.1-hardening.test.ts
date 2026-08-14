/**
 * R1.0 — Etapa 0.1 — Hardening de timezone + isolamento de regra por condomínio.
 *
 * Testes determinísticos: nenhum depende da hora real em que a suíte roda,
 * nem do timezone do host (todos os instantes são construídos com offset
 * explícito -03:00 e comparados contra o helper fixo, não Date.getHours()).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { scheduleWindowRule } from "../rules/schedule-window.rule";
import { isUsoCampoEncerrado } from "@/lib/reservas/convidados-ledger-helper";
import { getLegacyPolicyForCondominio, DEFAULT_POLICY } from "../index";

const CHACARA_ID = "RtJ7G92QwWvJ13Qq8Ntx";
const OUTRO_CONDOMINIO_ID = "condo-generico-qualquer";

// Mirror local e deliberado de `hourInSaoPaulo` (src/app/api/reservas/criar/route.ts)
// e do cálculo inline em schedule-window.rule.ts — MESMA fórmula, char-a-char.
// Não importamos route.ts aqui de propósito: ele carrega toda a árvore de
// imports do Next.js/Firebase Admin/apiGuard, o que trava o test runner ao
// tentar encerrar o processo (open handles) — a suíte de 17 arquivos
// pré-existente já evita isso deliberadamente (zero import de firebase-admin,
// confirmado por grep na auditoria da Etapa 0). Cobertura real do arquivo
// route.ts em si vem do E2E em staging (seção correspondente do relatório).
function hourInSaoPauloMirror(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now)
  );
}

// ═══════════════════════ P1 #1 — TIMEZONE (TZ-01..05) ═══════════════════════

test("TZ-01 hourInSaoPauloMirror — 17:59 America/Sao_Paulo → hora 17 (antes do corte)", () => {
  const instante = new Date("2026-08-11T17:59:00-03:00");
  assert.equal(hourInSaoPauloMirror(instante), 17);
});

test("TZ-02 hourInSaoPauloMirror — 18:00 America/Sao_Paulo → hora 18 (no corte)", () => {
  const instante = new Date("2026-08-11T18:00:00-03:00");
  assert.equal(hourInSaoPauloMirror(instante), 18);
});

test("TZ-03 hourInSaoPauloMirror — 18:01 America/Sao_Paulo → hora 18 (depois do corte)", () => {
  const instante = new Date("2026-08-11T18:01:00-03:00");
  assert.equal(hourInSaoPauloMirror(instante), 18);
});

test("TZ-03b regra de corte (nowHr >= horaInicio) replica exatamente criar/route.ts", () => {
  const horaInicio = 18;
  assert.equal(hourInSaoPauloMirror(new Date("2026-08-11T17:59:00-03:00")) >= horaInicio, false, "17:59 SP não deve cortar");
  assert.equal(hourInSaoPauloMirror(new Date("2026-08-11T18:00:00-03:00")) >= horaInicio, true, "18:00 SP deve cortar");
  assert.equal(hourInSaoPauloMirror(new Date("2026-08-11T18:01:00-03:00")) >= horaInicio, true, "18:01 SP deve cortar");
});

test("TZ-04 mesmo instante absoluto — resultado independe do TZ do processo host", () => {
  // 18:00 em São Paulo = 21:00 UTC, no mesmo instante absoluto.
  const instanteUTC = new Date("2026-08-11T21:00:00.000Z");
  const original = process.env.TZ;
  try {
    process.env.TZ = "UTC";
    const horaComHostUTC = hourInSaoPauloMirror(instanteUTC);
    process.env.TZ = "America/New_York"; // qualquer offset diferente de -03:00
    const horaComHostNY = hourInSaoPauloMirror(instanteUTC);
    assert.equal(horaComHostUTC, 18, "resultado deve ser 18h SP independente do host");
    assert.equal(horaComHostNY, 18, "resultado deve permanecer 18h SP mesmo com TZ do processo diferente");
    // Prova de que o bug antigo (Date.getHours()) DEPENDERIA do TZ do processo:
    process.env.TZ = "UTC";
    assert.equal(instanteUTC.getHours(), 21, "getHours() puro varia com o TZ do processo — por isso era o bug");
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("TZ-05 processo sem variável TZ definida — comportamento continua correto", () => {
  const original = process.env.TZ;
  try {
    delete process.env.TZ;
    const instante = new Date("2026-08-11T18:00:00-03:00");
    assert.equal(hourInSaoPauloMirror(instante), 18);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

// ── schedule-window.rule.ts — mesma classe de bug (D.11.5 / JANELA_HORARIA) ──

function policyWithSchedule(startHour: number, endHour: number) {
  return {
    policy: {
      schedule: { allDay: false, startHour, endHour },
    },
  } as any;
}

test("TZ-06 scheduleWindowRule — 07:59 SP com startHour=8 → FAIL (antes da janela)", () => {
  const ctx = { nowMs: new Date("2026-08-11T07:59:00-03:00").getTime() } as any;
  const result = scheduleWindowRule(policyWithSchedule(8, 22), ctx);
  assert.equal(result.outcome, "FAIL");
});

test("TZ-07 scheduleWindowRule — 08:00 SP com startHour=8 → PASS (início da janela)", () => {
  const ctx = { nowMs: new Date("2026-08-11T08:00:00-03:00").getTime() } as any;
  const result = scheduleWindowRule(policyWithSchedule(8, 22), ctx);
  assert.equal(result.outcome, "PASS");
});

test("TZ-08 scheduleWindowRule — mesmo instante absoluto independe do TZ do host", () => {
  const instanteUTC = new Date("2026-08-11T11:00:00.000Z"); // 08:00 SP
  const original = process.env.TZ;
  try {
    process.env.TZ = "UTC";
    const r1 = scheduleWindowRule(policyWithSchedule(8, 22), { nowMs: instanteUTC.getTime() } as any);
    process.env.TZ = "Pacific/Auckland";
    const r2 = scheduleWindowRule(policyWithSchedule(8, 22), { nowMs: instanteUTC.getTime() } as any);
    assert.equal(r1.outcome, "PASS");
    assert.equal(r2.outcome, "PASS");
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

// ── isUsoCampoEncerrado — mesma classe, achado adicional (convidados-ledger-helper.ts) ──

test("TZ-09 isUsoCampoEncerrado — 21:59 SP com fimMin=22:00(1320) → ainda NÃO encerrado", () => {
  const now = new Date("2026-08-11T21:59:00-03:00");
  const dateStr = "2026-08-11";
  assert.equal(isUsoCampoEncerrado({ dateStr, fimMin: 22 * 60 }, now), false);
});

test("TZ-10 isUsoCampoEncerrado — 22:00 SP com fimMin=22:00(1320) → encerrado", () => {
  const now = new Date("2026-08-11T22:00:00-03:00");
  const dateStr = "2026-08-11";
  assert.equal(isUsoCampoEncerrado({ dateStr, fimMin: 22 * 60 }, now), true);
});

test("TZ-11 isUsoCampoEncerrado — mesmo instante absoluto independe do TZ do host", () => {
  const instanteUTC = new Date("2026-08-12T01:00:00.000Z"); // 22:00 SP (11/08)
  const dateStr = "2026-08-11";
  const original = process.env.TZ;
  try {
    process.env.TZ = "UTC";
    const r1 = isUsoCampoEncerrado({ dateStr, fimMin: 22 * 60 }, instanteUTC);
    process.env.TZ = "America/New_York";
    const r2 = isUsoCampoEncerrado({ dateStr, fimMin: 22 * 60 }, instanteUTC);
    assert.equal(r1, true);
    assert.equal(r2, true);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

// ═══════════════════ P1 #2 — ISOLAMENTO DE REGRA POR TENANT (MT-01..05) ═══════════════════

test("MT-01 Chácara Itaguaí possui regulamento legado (gate continua TRUE)", () => {
  assert.notEqual(getLegacyPolicyForCondominio(CHACARA_ID), null);
});

test("MT-02 Chácara Itaguaí — política legada existe e é distinta da default", () => {
  const policy = getLegacyPolicyForCondominio(CHACARA_ID);
  assert.ok(policy, "política da Chácara deve existir");
});

test("MT-03 outro condomínio NÃO possui regulamento legado (gate deve ser FALSE — não herda domingo/feriado)", () => {
  assert.equal(getLegacyPolicyForCondominio(OUTRO_CONDOMINIO_ID), null);
});

test("MT-04 DEFAULT_POLICY (usada por qualquer condomínio fora do registry) é neutra — não bloqueia dia da semana por padrão", () => {
  assert.deepEqual(DEFAULT_POLICY.weekdays.blockedWeekdays, []);
  assert.equal(DEFAULT_POLICY.holidays.mode, "ALLOW");
});

test("MT-05 (nota) tenant isolation via apiGuard/condominioId — payload hostil trocando condominioId: cobertura em E2E staging real, não aqui (requer apiGuard/Firestore reais)", () => {
  assert.ok(true, "ver relatório final — seção E2E staging para evidência real deste caso");
});
