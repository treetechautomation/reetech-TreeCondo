/**
 * FASE D.11.5 — TESTES DOS NOVOS RULE CODES.
 *
 * Cobre os 7 novos RuleCodes:
 *   - CANCELAMENTO_MULTA, LISTA_CONVIDADOS_OBRIGATORIA, LISTA_CONVIDADOS_BLOQUEIO,
 *     CHECKIN_OBRIGATORIO, NO_SHOW_PENALIDADE, JANELA_HORARIA, DATA_BLOQUEADA_ADMIN.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  compileSnapshot,
  legacySnapshot,
  makeContext,
  validate,
  type CompiledPolicy,
  type MemberFacts,
  type PolicyContext,
  type PolicyTargetRef,
} from "../index";

const NOW = new Date("2026-07-15T15:00:00.000Z");
const TARGET: PolicyTargetRef = { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas" };
const MONDAY = "2026-07-20";

function membroAtivo(over: Partial<MemberFacts> = {}): MemberFacts {
  return {
    uid: "uid-morador", exists: true, status: "ATIVO", role: "MORADOR",
    blocoIdNorm: null, unidadeIdNorm: null, isSuperAdmin: false, isPaidUp: null,
    recentNoShows: 0, suspendedUntil: null, ...over,
  };
}

function ctx(over: Partial<PolicyContext> & { dateStr?: string } = {}): PolicyContext {
  return makeContext({
    now: NOW, dateStr: over.dateStr ?? MONDAY, target: TARGET,
    actor: membroAtivo(), ...over,
  });
}

// ════════════════════════════════ CANCELAMENTO_MULTA ═════════════════════════

test("D115-01 CANCELAMENTO_MULTA — sem multa configurada ⇒ SKIP", () => {
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const r = validate("CANCEL", v0, ctx({
    dateStr: "2026-07-16",
    reserva: { eventMs: Date.UTC(2026, 6, 16, 12), status: "APROVADA", valorCobradoCentavos: 0 },
  }));
  const result = r.results.find((x) => x.code === "CANCELAMENTO_MULTA");
  assert.ok(result);
  assert.equal(result.outcome, "SKIP");
});

test("D115-02 CANCELAMENTO_MULTA — multa configurada, dentro da janela ⇒ PASS", () => {
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const r = validate("CANCEL", v0, ctx({
    dateStr: "2026-07-20", // 117h antes
    reserva: { eventMs: Date.UTC(2026, 6, 20, 12), status: "APROVADA", valorCobradoCentavos: 0 },
  }));
  const result = r.results.find((x) => x.code === "CANCELAMENTO_MULTA");
  assert.ok(result);
  assert.equal(result.outcome, "SKIP"); // lateCancelFeeCentavos=null no legacy
});

// ════════════════════════ LISTA_CONVIDADOS_OBRIGATORIA ═══════════════════════

test("D115-03 LISTA_CONVIDADOS_OBRIGATORIA — não se aplica a CREATE (lista só existe após reserva)", () => {
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const r = validate("CREATE", v0, ctx());
  const result = r.results.find((x) => x.code === "LISTA_CONVIDADOS_OBRIGATORIA");
  assert.equal(result, undefined); // D.11.9.1: regra removida do CREATE
});

test("D115-04 LISTA_CONVIDADOS_OBRIGATORIA — obrigatória, sem convidados no APPROVE ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.capacity.guestList.required = true;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("APPROVE", compiled, ctx({ guestCount: 0 }));
  const result = r.results.find((x) => x.code === "LISTA_CONVIDADOS_OBRIGATORIA");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("D115-05 LISTA_CONVIDADOS_OBRIGATORIA — obrigatória, com convidados no APPROVE ⇒ PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.capacity.guestList.required = true;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("APPROVE", compiled, ctx({ guestCount: 5 }));
  const result = r.results.find((x) => x.code === "LISTA_CONVIDADOS_OBRIGATORIA");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});

// ════════════════════════ LISTA_CONVIDADOS_BLOQUEIO ══════════════════════════

test("D115-06 LISTA_CONVIDADOS_BLOQUEIO — não configurada ⇒ SKIP", () => {
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const r = validate("GUEST_LIST_EDIT", v0, ctx());
  const result = r.results.find((x) => x.code === "LISTA_CONVIDADOS_BLOQUEIO");
  assert.ok(result);
  assert.equal(result.outcome, "SKIP");
});

test("D115-07 LISTA_CONVIDADOS_BLOQUEIO — configurada, fora do prazo ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.capacity.guestList.lockAfterDeadline = true;
  snap.policy.capacity.guestList.submitDeadlineHours = 48;
  const compiled = compileSnapshot(snap, NOW);
  // data=2026-07-16, now=2026-07-15T15:00Z → ~21h até o evento (< 48h)
  const r = validate("GUEST_LIST_EDIT", compiled, ctx({ dateStr: "2026-07-16" }));
  const result = r.results.find((x) => x.code === "LISTA_CONVIDADOS_BLOQUEIO");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("D115-08 LISTA_CONVIDADOS_BLOQUEIO — configurada, dentro do prazo ⇒ PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.capacity.guestList.lockAfterDeadline = true;
  snap.policy.capacity.guestList.submitDeadlineHours = 24;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("GUEST_LIST_EDIT", compiled, ctx({ dateStr: "2026-07-20" }));
  const result = r.results.find((x) => x.code === "LISTA_CONVIDADOS_BLOQUEIO");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});

// ════════════════════════════════ CHECKIN_OBRIGATORIO ════════════════════════

test("D115-09 CHECKIN_OBRIGATORIO — não configurado ⇒ SKIP", () => {
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const r = validate("CHECK_IN", v0, ctx());
  const result = r.results.find((x) => x.code === "CHECKIN_OBRIGATORIO");
  assert.ok(result);
  assert.equal(result.outcome, "SKIP");
});

test("D115-10 CHECKIN_OBRIGATORIO — obrigatório, não realizado ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.checkin.required = true;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CHECK_IN", compiled, ctx({ checkinCompleted: false }));
  const result = r.results.find((x) => x.code === "CHECKIN_OBRIGATORIO");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("D115-11 CHECKIN_OBRIGATORIO — obrigatório, realizado ⇒ PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.checkin.required = true;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CHECK_IN", compiled, ctx({ checkinCompleted: true }));
  const result = r.results.find((x) => x.code === "CHECKIN_OBRIGATORIO");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});

// ════════════════════════════════ NO_SHOW_PENALIDADE ═════════════════════════

test("D115-12 NO_SHOW_PENALIDADE — sem penalidade configurada ⇒ SKIP", () => {
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const r = validate("CREATE", v0, ctx());
  const result = r.results.find((x) => x.code === "NO_SHOW_PENALIDADE");
  assert.ok(result);
  assert.equal(result.outcome, "SKIP");
});

test("D115-13 NO_SHOW_PENALIDADE — penalidade configurada, sem no-shows ⇒ PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.cancellation.noShowPenaltyCentavos = 5000;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({ actor: membroAtivo({ recentNoShows: 0 }) }));
  const result = r.results.find((x) => x.code === "NO_SHOW_PENALIDADE");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});

test("D115-14 NO_SHOW_PENALIDADE — penalidade configurada, com no-shows ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.cancellation.noShowPenaltyCentavos = 5000;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({ actor: membroAtivo({ recentNoShows: 2 }) }));
  const result = r.results.find((x) => x.code === "NO_SHOW_PENALIDADE");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

// ════════════════════════════════ JANELA_HORARIA ═════════════════════════════

test("D115-15 JANELA_HORARIA — dia inteiro ⇒ SKIP", () => {
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const r = validate("CREATE", v0, ctx());
  const result = r.results.find((x) => x.code === "JANELA_HORARIA");
  assert.ok(result);
  assert.equal(result.outcome, "SKIP");
});

test("D115-16 JANELA_HORARIA — janela configurada, dentro do horário ⇒ PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.schedule.allDay = false;
  snap.policy.schedule.startHour = 8;
  snap.policy.schedule.endHour = 22;
  const compiled = compileSnapshot(snap, NOW);
  // NOW = 15:00 UTC = 12:00 SP → dentro de [8, 22)
  const r = validate("CREATE", compiled, ctx());
  const result = r.results.find((x) => x.code === "JANELA_HORARIA");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});

test("D115-17 JANELA_HORARIA — janela configurada, antes do início ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.schedule.allDay = false;
  snap.policy.schedule.startHour = 18;
  snap.policy.schedule.endHour = 22;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({ nowMs: Date.UTC(2026, 6, 15, 5, 0, 0) }));
  const result = r.results.find((x) => x.code === "JANELA_HORARIA");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

// ═══════════════════════════════ DATA_BLOQUEADA_ADMIN ════════════════════════

test("D115-18 DATA_BLOQUEADA_ADMIN — sem datas bloqueadas ⇒ SKIP", () => {
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const r = validate("CREATE", v0, ctx({ dateStr: "2026-07-20" }));
  const result = r.results.find((x) => x.code === "DATA_BLOQUEADA_ADMIN");
  assert.ok(result);
  assert.equal(result.outcome, "SKIP");
});

test("D115-19 DATA_BLOQUEADA_ADMIN — data bloqueada via custom ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.holidays.custom = [
    { date: "2026-07-20", label: "Manutenção programada", mode: "BLOCK" },
  ];
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({ dateStr: "2026-07-20" }));
  const result = r.results.find((x) => x.code === "DATA_BLOQUEADA_ADMIN");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("D115-20 DATA_BLOQUEADA_ADMIN — data não bloqueada ⇒ PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.holidays.custom = [
    { date: "2026-07-20", label: "Manutenção", mode: "BLOCK" },
  ];
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({ dateStr: "2026-07-21" }));
  const result = r.results.find((x) => x.code === "DATA_BLOQUEADA_ADMIN");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});

// ════════════════════════════ COMPLETAR PARCIAIS ═════════════════════════════

test("D115-21 QUITACAO_PENDENTE — ativada, inadimplente ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.financial.requiresPaidUpMember = true;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({ actor: membroAtivo({ isPaidUp: false }) }));
  const result = r.results.find((x) => x.code === "QUITACAO_PENDENTE");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("D115-22 QUITACAO_PENDENTE — ativada, adimplente ⇒ PASS", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.financial.requiresPaidUpMember = true;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({ actor: membroAtivo({ isPaidUp: true }) }));
  const result = r.results.find((x) => x.code === "QUITACAO_PENDENTE");
  assert.ok(result);
  assert.equal(result.outcome, "PASS");
});

test("D115-23 LIMITE_MENSAL — configurado, excedido ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.quota.maxPerMonthPerUnit = 2;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({
    quota: { monthCountForUnit: 2, activeFutureForUnit: 0, queueSizeForSlot: 0 },
  }));
  const result = r.results.find((x) => x.code === "LIMITE_MENSAL");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("D115-24 LIMITE_RESERVAS_ATIVAS — configurado, excedido ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.quota.maxActiveFuturePerUnit = 1;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({
    quota: { monthCountForUnit: 0, activeFutureForUnit: 1, queueSizeForSlot: 0 },
  }));
  const result = r.results.find((x) => x.code === "LIMITE_RESERVAS_ATIVAS");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("D115-25 CAPACIDADE_EXCEDIDA — configurada, excedida ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.capacity.maxPeople = 10;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CHECK_IN", compiled, ctx({ guestCount: 15 }));
  const result = r.results.find((x) => x.code === "CAPACIDADE_EXCEDIDA");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});

test("D115-26 SUSPENSO_NO_SHOW — ativado, suspenso ⇒ FAIL", () => {
  const snap = legacySnapshot(TARGET, NOW);
  snap.policy.cancellation.noShowTrackingEnabled = true;
  snap.policy.cancellation.noShowSuspensionDays = 30;
  const compiled = compileSnapshot(snap, NOW);
  const r = validate("CREATE", compiled, ctx({
    actor: membroAtivo({ suspendedUntil: "2026-08-01" }),
  }));
  const result = r.results.find((x) => x.code === "SUSPENSO_NO_SHOW");
  assert.ok(result);
  assert.equal(result.outcome, "FAIL");
});
