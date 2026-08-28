/**
 * FIX.ANUNCIOS.2A — testes comportamentais reais (não estáticos) do motor
 * de agendamento: src/lib/anuncios/scheduling.ts. Módulo puro, sem
 * dependência de firebase-admin, então roda de verdade sob node:test.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseZonedDateTimeLocal,
  evaluateSchedulingEligibility,
  canClaimNotification,
  BUSINESS_TIMEZONE,
  NOTIFICATION_CLAIM_STALE_MS,
} from "../scheduling";

// --- parseZonedDateTimeLocal ---

test("parseZonedDateTimeLocal: converte datetime-local em America/Sao_Paulo (UTC-3) para instante UTC correto", () => {
  const d = parseZonedDateTimeLocal("2026-09-01T10:00", "America/Sao_Paulo");
  assert.ok(d instanceof Date);
  // 10:00 em São Paulo (UTC-3, sem DST desde 2019) == 13:00 UTC.
  assert.equal(d!.toISOString(), "2026-09-01T13:00:00.000Z");
});

test("parseZonedDateTimeLocal: aceita segundos opcionais", () => {
  const d = parseZonedDateTimeLocal("2026-09-01T10:00:30", "America/Sao_Paulo");
  assert.equal(d!.toISOString(), "2026-09-01T13:00:30.000Z");
});

test("parseZonedDateTimeLocal: usa BUSINESS_TIMEZONE como default", () => {
  assert.equal(BUSINESS_TIMEZONE, "America/Sao_Paulo");
  const d = parseZonedDateTimeLocal("2026-09-01T10:00");
  assert.equal(d!.toISOString(), "2026-09-01T13:00:00.000Z");
});

test("parseZonedDateTimeLocal: retorna null para string vazia", () => {
  assert.equal(parseZonedDateTimeLocal(""), null);
  assert.equal(parseZonedDateTimeLocal("   "), null);
});

test("parseZonedDateTimeLocal: retorna null para tipo não-string", () => {
  assert.equal(parseZonedDateTimeLocal(null), null);
  assert.equal(parseZonedDateTimeLocal(undefined), null);
  assert.equal(parseZonedDateTimeLocal(12345), null);
  assert.equal(parseZonedDateTimeLocal({ _seconds: 123 }), null);
});

test("parseZonedDateTimeLocal: retorna null para string não-parseável", () => {
  assert.equal(parseZonedDateTimeLocal("não é uma data"), null);
  assert.equal(parseZonedDateTimeLocal("2026-09-01"), null); // falta hora
  assert.equal(parseZonedDateTimeLocal("10:00"), null); // falta data
});

test("parseZonedDateTimeLocal: rejeita data de calendário impossível", () => {
  assert.equal(parseZonedDateTimeLocal("2026-02-30T10:00"), null); // fevereiro não tem dia 30
  assert.equal(parseZonedDateTimeLocal("2026-13-01T10:00"), null); // mês 13
});

test("parseZonedDateTimeLocal: rejeita hora/minuto impossíveis", () => {
  assert.equal(parseZonedDateTimeLocal("2026-09-01T25:00"), null);
  assert.equal(parseZonedDateTimeLocal("2026-09-01T10:60"), null);
});

test("parseZonedDateTimeLocal: funciona para outro timezone (UTC), confirmando que não é hardcoded", () => {
  const d = parseZonedDateTimeLocal("2026-09-01T10:00", "UTC");
  assert.equal(d!.toISOString(), "2026-09-01T10:00:00.000Z");
});

// --- FIX.ANUNCIOS.2A.1: expiresAt usa exatamente o mesmo parser que publishAt ---

test("FIX.2A.1: expiresAt e publishAt com o mesmo horário civil produzem o MESMO instante (mesmo parser, mesma interpretação)", () => {
  const publishAt = parseZonedDateTimeLocal("2026-09-01T10:00");
  const expiresAt = parseZonedDateTimeLocal("2026-09-01T10:00");
  assert.equal(publishAt!.getTime(), expiresAt!.getTime());
});

test("FIX.2A.1: demonstra explicitamente o desvio de 3h que existiria com new Date(string-sem-offset) no host (UTC) vs. o resultado correto em America/Sao_Paulo", () => {
  const INPUT = "2026-09-01T10:00";

  // Comportamento ANTIGO (o que readDateFlexible/new Date(string) produzia
  // rodando no host de produção, que está em UTC — confirmado
  // independentemente do TZ de onde este teste é executado, forçando a
  // interpretação "como se já fosse UTC" explicitamente com um sufixo Z):
  // 10:00 "virava" 10:00Z.
  const oldAmbiguousResult = new Date(INPUT + "Z");

  // Comportamento CORRIGIDO: 10:00 é horário civil em America/Sao_Paulo
  // (UTC-3), logo o instante real é 13:00Z.
  const correctResult = parseZonedDateTimeLocal(INPUT, "America/Sao_Paulo");

  assert.equal(correctResult!.toISOString(), "2026-09-01T13:00:00.000Z");
  const diffHours = (correctResult!.getTime() - oldAmbiguousResult.getTime()) / (60 * 60 * 1000);
  assert.equal(diffHours, 3, "o desvio entre a interpretação antiga (ambígua) e a corrigida deve ser exatamente 3h");
});

// --- evaluateSchedulingEligibility ---

test("evaluateSchedulingEligibility: publishAt no futuro NÃO é elegível", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const future = new Date("2026-01-02T00:00:00Z");
  const r = evaluateSchedulingEligibility("AGENDADO", future, now);
  assert.equal(r.eligible, false);
  if (!r.eligible) assert.equal(r.reason, "future");
});

test("evaluateSchedulingEligibility: publishAt no passado É elegível", () => {
  const now = new Date("2026-01-02T00:00:00Z");
  const past = new Date("2026-01-01T00:00:00Z");
  const r = evaluateSchedulingEligibility("AGENDADO", past, now);
  assert.equal(r.eligible, true);
});

test("evaluateSchedulingEligibility: publishAt exatamente igual a now É elegível (janela fechada <=)", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");
  const r = evaluateSchedulingEligibility("AGENDADO", new Date(now.getTime()), now);
  assert.equal(r.eligible, true);
});

test("evaluateSchedulingEligibility: publishAt nulo/inválido NUNCA é tratado como vencido", () => {
  const now = new Date();
  const r1 = evaluateSchedulingEligibility("AGENDADO", null, now);
  assert.equal(r1.eligible, false);
  if (!r1.eligible) assert.equal(r1.reason, "invalid_publish_at");

  const r2 = evaluateSchedulingEligibility("AGENDADO", new Date(NaN), now);
  assert.equal(r2.eligible, false);
  if (!r2.eligible) assert.equal(r2.reason, "invalid_publish_at");
});

test("evaluateSchedulingEligibility: status diferente de AGENDADO nunca é elegível, mesmo com publishAt válido no passado", () => {
  const now = new Date("2026-01-02T00:00:00Z");
  const past = new Date("2026-01-01T00:00:00Z");
  for (const status of ["RASCUNHO", "PUBLICADO", "ARQUIVADO", undefined, ""]) {
    const r = evaluateSchedulingEligibility(status, past, now);
    assert.equal(r.eligible, false, `status=${status} não deveria ser elegível`);
    if (!r.eligible) assert.equal(r.reason, "not_scheduled");
  }
});

// --- canClaimNotification (concorrência) ---

test("canClaimNotification: nunca tentado (null/undefined) pode reivindicar", () => {
  assert.equal(canClaimNotification(null, null, new Date()), true);
  assert.equal(canClaimNotification(undefined, null, new Date()), true);
});

test("canClaimNotification: FAILED pode reivindicar novamente (retry)", () => {
  assert.equal(canClaimNotification("FAILED", new Date(), new Date()), true);
});

test("canClaimNotification: SENT nunca pode reivindicar de novo", () => {
  assert.equal(canClaimNotification("SENT", new Date(), new Date()), false);
});

test("canClaimNotification: PENDING recente NÃO pode ser reivindicado por outra execução (evita duplicata)", () => {
  const now = new Date("2026-01-01T12:05:00Z");
  const claimedRecently = new Date("2026-01-01T12:04:00Z"); // 1 min atrás, dentro da janela
  assert.equal(canClaimNotification("PENDING", claimedRecently, now, NOTIFICATION_CLAIM_STALE_MS), false);
});

test("canClaimNotification: PENDING travado (mais velho que o timeout) pode ser reivindicado — recuperação de crash", () => {
  const now = new Date("2026-01-01T12:10:00Z");
  const claimedLongAgo = new Date("2026-01-01T12:00:00Z"); // 10 min atrás, além da janela de 5 min
  assert.equal(canClaimNotification("PENDING", claimedLongAgo, now, NOTIFICATION_CLAIM_STALE_MS), true);
});

test("canClaimNotification: PENDING sem timestamp de reivindicação (estado inconsistente) é tratado como reivindicável", () => {
  assert.equal(canClaimNotification("PENDING", null, new Date()), true);
});

test("canClaimNotification: simula duas execuções concorrentes — apenas a que vê o estado mais recente reivindica", () => {
  // Execução 1 reivindica primeiro.
  const now1 = new Date("2026-01-01T12:00:00Z");
  const claim1 = canClaimNotification(null, null, now1);
  assert.equal(claim1, true);

  // Execução 2, milissegundos depois, já vê o estado PENDING recém-gravado
  // pela execução 1 — não deve reivindicar (isso é o que a transaction do
  // Firestore garante na prática: a leitura de execução 2 só "vence" a
  // corrida se ler antes do commit de execução 1; se ler depois, este é o
  // resultado esperado).
  const now2 = new Date("2026-01-01T12:00:00.050Z");
  const claim2 = canClaimNotification("PENDING", now1, now2);
  assert.equal(claim2, false);
});
