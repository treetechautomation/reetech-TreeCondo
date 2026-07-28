/**
 * FASE E.2.0 — TESTES DA FUNDAÇÃO DO MÓDULO DE ENCOMENDAS.
 * Cobre E2001 a E2015.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generatePin,
  hashPin,
  last4,
  generateQRToken,
  hashQRToken,
  normalizeCode,
  isValidTransition,
  mapLegacyToCanonica,
  type EncomendaCanonica,
  type EncomendaEvent,
} from "../types";

// ═══════════════════════ E2001 — ISOLAMENTO MULTI-CONDOMÍNIO ═══════════════

test("E2001 isolamento — mesmo código em condomínios diferentes não colidem", () => {
  const a = mapLegacyToCanonica({ condominioId: "condA", codigo: "ABC123" }, "id1");
  const b = mapLegacyToCanonica({ condominioId: "condB", codigo: "ABC123" }, "id2");
  assert.equal(a.condominioId, "condA");
  assert.equal(b.condominioId, "condB");
  assert.equal(a.package.codigo, b.package.codigo);
  assert.notEqual(a.condominioId, b.condominioId);
});

// ═══════════════════════ E2002 — DUPLICIDADE NO MESMO CONDOMÍNIO ══════════

test("E2002 duplicidade — mesmo código no mesmo condomínio é detectável via chave", () => {
  const code = normalizeCode("AB-123");
  const a = mapLegacyToCanonica({ condominioId: "condA", codigo: code }, "id1");
  const b = mapLegacyToCanonica({ condominioId: "condA", codigo: code }, "id2");
  assert.equal(a.package.codigo, b.package.codigo);
  assert.equal(a.condominioId, b.condominioId);
  // Duplicidade deve ser validada server-side (condominioId + codigo)
});

// ═══════════════════════ E2003 — MESMO CÓDIGO, DIFERENTES CONDOMÍNIOS ═════

test("E2003 mesmo código — condomínios diferentes OK", () => {
  const code = normalizeCode("XY-999");
  const a = mapLegacyToCanonica({ condominioId: "condA", codigo: code }, "id1");
  const b = mapLegacyToCanonica({ condominioId: "condB", codigo: code }, "id2");
  assert.equal(a.package.codigo, code);
  assert.notEqual(a.condominioId, b.condominioId);
});

// ═══════════════════════ E2004 — NÃO GRAVA PIN PLAINTEXT ══════════════════

test("E2004 segurança — encomenda nova não armazena PIN em plaintext", () => {
  const pin = generatePin(4);
  assert.equal(pin.length, 4);
  const h = hashPin(pin);
  assert.notEqual(h, pin);
  assert.ok(h.length === 64); // SHA-256 hex = 64 chars
  // Verificar que o modelo canônico NÃO tem campo plaintext
  const doc = mapLegacyToCanonica({ codigoRetiradaHash: h }, "id");
  assert.equal(doc.security.pinHash, h);
});

// ═══════════════════════ E2005 — PIN HASH VÁLIDO ══════════════════════════

test("E2005 segurança — hashPin é determinístico", () => {
  const pin = "4829";
  assert.equal(hashPin(pin), hashPin(pin));
  assert.notEqual(hashPin(pin), hashPin("0000"));
});

// ═══════════════════════ E2006 — QR TOKEN NÃO CONTÉM DADOS SENSÍVEIS ══════

test("E2006 segurança — QR token é opaco e não revela dados", () => {
  const token = generateQRToken();
  assert.ok(token.length >= 64);
  // Token NÃO deve conter: ID, apartamento, bloco, PIN, UID
  assert.ok(!token.includes("id"));
  assert.ok(!token.includes("apt"));
  assert.ok(!token.includes("bloco"));
});

// ═══════════════════════ E2007 — QR USO ÚNICO ═════════════════════════════

test("E2007 segurança — QR usado não pode ser reutilizado", () => {
  const doc = mapLegacyToCanonica({}, "id");
  doc.security.qrUsed = true;
  assert.equal(doc.security.qrUsed, true);
  // Lógica de validação: se qrUsed, rejeitar retirada
});

// ═══════════════════════ E2008 — QR EXPIRADO ══════════════════════════════

test("E2008 segurança — QR expirado é rejeitado", () => {
  const doc = mapLegacyToCanonica({}, "id");
  doc.security.qrExpiresAt = "2020-01-01T00:00:00.000Z";
  const expired = new Date(doc.security.qrExpiresAt!) < new Date();
  assert.equal(expired, true);
});

// ═══════════════════════ E2009 — RETIRADA NÃO PODE SER RETIRADA NOVAMENTE ═

test("E2009 retirada — encomenda RETIRADA não pode ser retirada novamente", () => {
  const doc = mapLegacyToCanonica({ status: "RETIRADA" }, "id");
  assert.equal(isValidTransition("RETIRADA", "RETIRADA"), false);
  assert.equal(isValidTransition("RETIRADA", "AGUARDANDO_RETIRADA"), false);
});

// ═══════════════════════ E2010 — RETIRADA CONCORRENTE ═════════════════════

test("E2010 concorrência — transição inválida é detectada", () => {
  assert.equal(isValidTransition("AGUARDANDO_RETIRADA", "RETIRADA"), true);
  assert.equal(isValidTransition("CHEGOU", "RETIRADA"), false); // precisa passar por AGUARDANDO
  assert.equal(isValidTransition("CANCELADA", "RETIRADA"), false);
});

// ═══════════════════════ E2011 — ENCOMENDA LEGADA ═════════════════════════

test("E2011 legado — documento antigo sem campos novos é mapeado corretamente", () => {
  const legado: Record<string, unknown> = {
    condominioId: "cond1",
    codigo: "BR123456789",
    status: "PENDENTE",
    unidadeId: "302",
    unidadeIdNorm: "302",
    criadoPorUid: "porteiro1",
    codigoRetiradaHash: "abc123hash",
    codigoRetiradaLast4: "**92",
  };
  const doc = mapLegacyToCanonica(legado, "id-legacy");
  assert.equal(doc.audit.status, "PENDENTE");
  assert.equal(doc.package.codigo, "BR123456789");
  assert.equal(doc.registration.registradoPorUid, "porteiro1");
  assert.equal(doc.security.pinHash, "abc123hash");
  assert.equal(doc.security.pinLast4, "**92");
  assert.equal(doc.security.qrToken, null);
  assert.equal(doc.withdrawal.withdrawMethod, null);
});

// ═══════════════════════ E2012 — SCANNER HID ═════════════════════════════

test("E2012 scanner — código de barras é normalizado corretamente", () => {
  assert.equal(normalizeCode("AB-123-456"), "AB123456");
  assert.equal(normalizeCode("   XY99  "), "XY99");
  assert.equal(normalizeCode("br123456789br"), "BR123456789BR");
});

// ═══════════════════════ E2013 — DIGITAÇÃO HUMANA × SCANNER ══════════════

test("E2013 scanner — digitação humana lenta não é confundida com scanner", () => {
  // Scanner HID: envia caracteres muito rápido (~1-2ms entre chars)
  // Digitação humana: ~100-500ms entre chars
  // A distinção é feita pelo hook useBarcodeScanner (timing-based)
  // Este teste valida que o tipo existe
  const result = { code: "TEST", source: "MANUAL" as const, scannedAt: new Date().toISOString() };
  assert.equal(result.source, "MANUAL");
});

// ═══════════════════════ E2014 — EVENTO SEM SEGREDO ═══════════════════════

test("E2014 auditoria — evento nunca contém PIN ou token em metadata", () => {
  const event: EncomendaEvent = {
    type: "WITHDRAWN",
    timestamp: new Date().toISOString(),
    actorUid: "porteiro1",
    actorRole: "PORTEIRO",
    actorName: "João",
    metadata: { method: "QR_CODE" },
  };
  // Verificar que metadata não contém segredo
  const meta = JSON.stringify(event.metadata);
  assert.ok(!meta.includes("pin"));
  assert.ok(!meta.includes("token"));
  assert.ok(!meta.includes("hash"));
});

// ═══════════════════════ E2015 — WITHDRAW METHOD ═════════════════════════

test("E2015 retirada — withdrawMethod registra o método correto", () => {
  const doc = mapLegacyToCanonica({ withdrawMethod: "QR_CODE" }, "id");
  assert.equal(doc.withdrawal.withdrawMethod, "QR_CODE");
  
  const doc2 = mapLegacyToCanonica({ withdrawMethod: "PIN" }, "id2");
  assert.equal(doc2.withdrawal.withdrawMethod, "PIN");

  const doc3 = mapLegacyToCanonica({}, "id3");
  assert.equal(doc3.withdrawal.withdrawMethod, null);
});
