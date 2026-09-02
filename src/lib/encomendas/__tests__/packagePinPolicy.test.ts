/**
 * ENCOMENDAS.2D — testes puros de src/lib/encomendas/packagePinPolicy.ts.
 * Sem Firestore, sem HTTP. Prova a política de expiração/tentativas/
 * bloqueio isoladamente antes da prova de persistência transacional
 * (ver package-pin-transaction.test.ts, com emulador).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";

import {
  evaluatePackagePinAttempt,
  PIN_MAX_ATTEMPTS,
  PIN_LOCK_DURATION_MS,
  type PackagePinSnapshot,
} from "../packagePinPolicy";

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

const PIN = "4821";
const PIN_HASH = sha256(PIN);
const NOW = new Date("2026-01-01T12:00:00.000Z");

function baseSnapshot(overrides: Partial<PackagePinSnapshot> = {}): PackagePinSnapshot {
  return {
    status: "AGUARDANDO",
    pinHash: PIN_HASH,
    pinExpiresAt: new Date(NOW.getTime() + 24 * 3600000).toISOString(),
    pinAttempts: 0,
    pinLockedUntil: null,
    ...overrides,
  };
}

// 1 — PIN correto e não expirado é aceito
test("PIN válido e não expirado: SUCCESS, sem mutation extra", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot(), PIN, NOW);
  assert.equal(r.outcome.code, "SUCCESS");
  assert.equal(r.mutation, null);
});

// 2-6 — persistência de tentativas consecutivas erradas
test("tentativa 1 errada: attempt=1, não bloqueia", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 0 }), "0000", NOW);
  assert.deepEqual(r.outcome, { code: "PIN_INVALID", attempt: 1, locked: false, lockedUntil: null });
  assert.deepEqual(r.mutation, { pinAttempts: 1, pinLockedUntil: null });
});

test("tentativa 2 errada: attempt=2", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 1 }), "0000", NOW);
  assert.equal((r.outcome as any).attempt, 2);
  assert.equal((r.outcome as any).locked, false);
});

test("tentativa 3 errada: attempt=3", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 2 }), "0000", NOW);
  assert.equal((r.outcome as any).attempt, 3);
});

test("tentativa 4 errada: attempt=4", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 3 }), "0000", NOW);
  assert.equal((r.outcome as any).attempt, 4);
  assert.equal((r.outcome as any).locked, false);
});

test("tentativa 5 errada: attempt=5 e ativa bloqueio de 15min", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 4 }), "0000", NOW);
  assert.equal(PIN_MAX_ATTEMPTS, 5);
  assert.equal(PIN_LOCK_DURATION_MS, 15 * 60 * 1000);
  assert.deepEqual(r.outcome, {
    code: "PIN_INVALID",
    attempt: 5,
    locked: true,
    lockedUntil: new Date(NOW.getTime() + PIN_LOCK_DURATION_MS).toISOString(),
  });
  assert.deepEqual(r.mutation, {
    pinAttempts: 5,
    pinLockedUntil: new Date(NOW.getTime() + PIN_LOCK_DURATION_MS).toISOString(),
  });
});

// 7-8 — bloqueio ativo
test("bloqueio ativo rejeita mesmo o PIN correto", () => {
  const lockedUntil = new Date(NOW.getTime() + 5 * 60000).toISOString();
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 5, pinLockedUntil: lockedUntil }), PIN, NOW);
  assert.deepEqual(r.outcome, { code: "PIN_LOCKED", lockedUntil });
});

test("bloqueio ativo não incrementa o contador (nenhuma mutation)", () => {
  const lockedUntil = new Date(NOW.getTime() + 5 * 60000).toISOString();
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 5, pinLockedUntil: lockedUntil }), "0000", NOW);
  assert.equal(r.outcome.code, "PIN_LOCKED");
  assert.equal(r.mutation, null);
});

// 9-11 — expiração do bloqueio (não do PIN) reseta o ciclo
test("bloqueio de 15min já vencido é tratado como expirado (não mais ativo)", () => {
  const lockedUntil = new Date(NOW.getTime() - 1000).toISOString(); // 1s no passado
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 5, pinLockedUntil: lockedUntil }), PIN, NOW);
  assert.equal(r.outcome.code, "SUCCESS");
});

test("primeira tentativa errada após bloqueio vencido reinicia o ciclo em attempt=1", () => {
  const lockedUntil = new Date(NOW.getTime() - 1000).toISOString();
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 5, pinLockedUntil: lockedUntil }), "0000", NOW);
  assert.deepEqual(r.outcome, { code: "PIN_INVALID", attempt: 1, locked: false, lockedUntil: null });
  assert.deepEqual(r.mutation, { pinAttempts: 1, pinLockedUntil: null });
});

test("PIN correto após bloqueio vencido sucede e limpa attempts/lock", () => {
  const lockedUntil = new Date(NOW.getTime() - 1000).toISOString();
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 5, pinLockedUntil: lockedUntil }), PIN, NOW);
  assert.equal(r.outcome.code, "SUCCESS");
  assert.deepEqual(r.mutation, { pinAttempts: 0, pinLockedUntil: null });
});

// 12-13 — expiração do PIN
test("PIN expirado é rejeitado (PIN_EXPIRED)", () => {
  const r = evaluatePackagePinAttempt(
    baseSnapshot({ pinExpiresAt: new Date(NOW.getTime() - 1000).toISOString() }),
    PIN,
    NOW
  );
  assert.equal(r.outcome.code, "PIN_EXPIRED");
});

test("PIN expirado exatamente no limite (<=) também é rejeitado", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinExpiresAt: NOW.toISOString() }), PIN, NOW);
  assert.equal(r.outcome.code, "PIN_EXPIRED");
});

test("PIN expirado NÃO incrementa tentativas (nenhuma mutation)", () => {
  const r = evaluatePackagePinAttempt(
    baseSnapshot({ pinExpiresAt: new Date(NOW.getTime() - 1000).toISOString(), pinAttempts: 2 }),
    "0000",
    NOW
  );
  assert.equal(r.outcome.code, "PIN_EXPIRED");
  assert.equal(r.mutation, null);
});

// 14 — pinExpiresAt ausente é fail-closed
test("pinExpiresAt ausente (credencial nova/canônica malformada) é fail-closed: tratado como expirado", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinExpiresAt: null }), PIN, NOW);
  assert.equal(r.outcome.code, "PIN_EXPIRED");
});

// 15 — hash ausente é fail-closed
test("pinHash ausente (credencial não configurada) falha fechado: CREDENTIAL_NOT_CONFIGURED", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinHash: null }), PIN, NOW);
  assert.equal(r.outcome.code, "CREDENTIAL_NOT_CONFIGURED");
  assert.equal(r.mutation, null);
});

// status
test("status diferente de AGUARDANDO (ex.: CANCELADA) é rejeitado com STATUS_INVALID", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ status: "CANCELADA" }), PIN, NOW);
  assert.equal(r.outcome.code, "STATUS_INVALID");
});

test("status RETIRADA é classificado especificamente como PACKAGE_ALREADY_WITHDRAWN", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ status: "RETIRADA" }), PIN, NOW);
  assert.equal(r.outcome.code, "PACKAGE_ALREADY_WITHDRAWN");
});

// 25-28 — nenhuma resposta expõe segredo/hash
test("resultado de PIN_INVALID nunca contém o hash esperado nem o PIN enviado", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 0 }), "0000", NOW);
  const serialized = JSON.stringify(r);
  assert.equal(serialized.includes(PIN_HASH), false);
  assert.equal(serialized.includes("0000"), false);
});

test("resultado de SUCCESS nunca contém o hash", () => {
  const r = evaluatePackagePinAttempt(baseSnapshot(), PIN, NOW);
  const serialized = JSON.stringify(r);
  assert.equal(serialized.includes(PIN_HASH), false);
});

test("resultado de PIN_LOCKED não contém hash nem PIN", () => {
  const lockedUntil = new Date(NOW.getTime() + 5 * 60000).toISOString();
  const r = evaluatePackagePinAttempt(baseSnapshot({ pinAttempts: 5, pinLockedUntil: lockedUntil }), PIN, NOW);
  const serialized = JSON.stringify(r);
  assert.equal(serialized.includes(PIN_HASH), false);
  assert.equal(serialized.includes(PIN), false);
});

test("resultado de PIN_EXPIRED não contém hash nem PIN", () => {
  const r = evaluatePackagePinAttempt(
    baseSnapshot({ pinExpiresAt: new Date(NOW.getTime() - 1000).toISOString() }),
    PIN,
    NOW
  );
  const serialized = JSON.stringify(r);
  assert.equal(serialized.includes(PIN_HASH), false);
  assert.equal(serialized.includes(PIN), false);
});
