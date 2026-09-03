/**
 * ENCOMENDAS.2E — testes puros de src/lib/encomendas/packageQrPolicy.ts.
 * Sem Firestore, sem HTTP.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { evaluatePackageQrAttempt, type PackageQrSnapshot } from "../packageQrPolicy";

const NOW = new Date("2026-01-01T12:00:00.000Z");

function baseSnapshot(overrides: Partial<PackageQrSnapshot> = {}): PackageQrSnapshot {
  return {
    status: "AGUARDANDO",
    qrExpiresAt: new Date(NOW.getTime() + 24 * 3600000).toISOString(),
    qrUsed: false,
    ...overrides,
  };
}

test("QR válido, não expirado, não usado: SUCCESS", () => {
  const r = evaluatePackageQrAttempt(baseSnapshot(), NOW);
  assert.equal(r.code, "SUCCESS");
});

test("status RETIRADA: PACKAGE_ALREADY_WITHDRAWN", () => {
  const r = evaluatePackageQrAttempt(baseSnapshot({ status: "RETIRADA" }), NOW);
  assert.equal(r.code, "PACKAGE_ALREADY_WITHDRAWN");
});

test("status fora do conjunto válido (ex.: CANCELADA): STATUS_INVALID", () => {
  const r = evaluatePackageQrAttempt(baseSnapshot({ status: "CANCELADA" }), NOW);
  assert.equal(r.code, "STATUS_INVALID");
});

test("aceita os três valores históricos de status pendente", () => {
  for (const status of ["AGUARDANDO_RETIRADA", "AGUARDANDO", "PENDENTE"]) {
    const r = evaluatePackageQrAttempt(baseSnapshot({ status }), NOW);
    assert.equal(r.code, "SUCCESS", `esperava SUCCESS para status=${status}`);
  }
});

test("QR expirado: QR_EXPIRED", () => {
  const r = evaluatePackageQrAttempt(baseSnapshot({ qrExpiresAt: new Date(NOW.getTime() - 1000).toISOString() }), NOW);
  assert.equal(r.code, "QR_EXPIRED");
});

test("QR sem qrExpiresAt: comportamento legado preservado (não expira)", () => {
  const r = evaluatePackageQrAttempt(baseSnapshot({ qrExpiresAt: null }), NOW);
  assert.equal(r.code, "SUCCESS");
});

test("QR já utilizado: QR_ALREADY_USED", () => {
  const r = evaluatePackageQrAttempt(baseSnapshot({ qrUsed: true }), NOW);
  assert.equal(r.code, "QR_ALREADY_USED");
});

test("expiração é verificada antes de já-utilizado (ordem de decisão)", () => {
  const r = evaluatePackageQrAttempt(
    baseSnapshot({ qrExpiresAt: new Date(NOW.getTime() - 1000).toISOString(), qrUsed: true }),
    NOW
  );
  assert.equal(r.code, "QR_EXPIRED");
});

test("resultado nunca contém campos de hash/token (apenas um código discriminado)", () => {
  const r = evaluatePackageQrAttempt(baseSnapshot({ qrUsed: true }), NOW);
  assert.deepEqual(Object.keys(r), ["code"]);
});
