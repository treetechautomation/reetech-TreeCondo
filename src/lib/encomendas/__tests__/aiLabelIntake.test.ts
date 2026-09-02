/**
 * ENCOMENDAS.2C — testes puros de src/lib/encomendas/aiLabelIntake.ts.
 * Sem import de firebaseAdmin (nenhuma inicialização de Firebase), sem
 * chamada real ao Gemini/genkit.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_LABEL_ALLOWED_ROLES,
  AI_LABEL_MAX_IMAGE_BYTES,
  validateImagePayload,
  sanitizeAiOutput,
} from "../aiLabelIntake";

function makeDataUrl(mime: string, byteLength: number): string {
  const buf = Buffer.alloc(byteLength, 1);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Contrato de papéis
test("AI_LABEL_ALLOWED_ROLES: exatamente PORTEIRO, ZELADOR, ADMIN, ADMIN_CONDOMINIO, SINDICO — MORADOR excluído", () => {
  assert.deepEqual(
    [...AI_LABEL_ALLOWED_ROLES].sort(),
    ["ADMIN", "ADMIN_CONDOMINIO", "PORTEIRO", "SINDICO", "ZELADOR"].sort()
  );
  assert.equal(AI_LABEL_ALLOWED_ROLES.includes("MORADOR" as any), false);
  assert.equal(AI_LABEL_ALLOWED_ROLES.includes("SEGURANCA" as any), false);
});

test("AI_LABEL_MAX_IMAGE_BYTES: teto de 10MB (mesmo teto já usado para anexos de imagem no app)", () => {
  assert.equal(AI_LABEL_MAX_IMAGE_BYTES, 10 * 1024 * 1024);
});

// validateImagePayload — ausência / malformação
test("validateImagePayload: imagem ausente é rejeitada", () => {
  const r = validateImagePayload(undefined);
  assert.equal(r.ok, false);
});

test("validateImagePayload: string vazia é rejeitada", () => {
  const r = validateImagePayload("");
  assert.equal(r.ok, false);
});

test("validateImagePayload: tipo não-string é rejeitado", () => {
  const r = validateImagePayload({ not: "a string" } as any);
  assert.equal(r.ok, false);
});

test("validateImagePayload: string sem prefixo data URL é rejeitada", () => {
  const r = validateImagePayload("aGVsbG8=");
  assert.equal(r.ok, false);
});

test("validateImagePayload: mime type fora da allowlist (ex.: application/pdf) é rejeitado", () => {
  const r = validateImagePayload(makeDataUrl("application/pdf", 100));
  assert.equal(r.ok, false);
});

test("validateImagePayload: mime type svg (potencial XSS) é rejeitado", () => {
  const r = validateImagePayload(makeDataUrl("image/svg+xml", 100));
  assert.equal(r.ok, false);
});

// validateImagePayload — tamanho
test("validateImagePayload: imagem dentro do teto é aceita", () => {
  const r = validateImagePayload(makeDataUrl("image/jpeg", 1024 * 1024));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.mimeType.toLowerCase(), "image/jpeg");
  }
});

test("validateImagePayload: imagem excedendo o teto de 10MB é rejeitada", () => {
  const r = validateImagePayload(makeDataUrl("image/png", AI_LABEL_MAX_IMAGE_BYTES + 1024));
  assert.equal(r.ok, false);
});

test("validateImagePayload: imagem exatamente no teto é aceita (limite inclusivo)", () => {
  const r = validateImagePayload(makeDataUrl("image/png", AI_LABEL_MAX_IMAGE_BYTES));
  assert.equal(r.ok, true);
});

// validateImagePayload — formatos aceitos
test("validateImagePayload: aceita jpeg, png, webp, heic", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
    const r = validateImagePayload(makeDataUrl(mime, 1024));
    assert.equal(r.ok, true, `esperava aceitar ${mime}`);
  }
});

// sanitizeAiOutput — allowlist
test("sanitizeAiOutput: mantém apenas os 5 campos conhecidos", () => {
  const out = sanitizeAiOutput({
    unidadeId: "101",
    blocoId: "A",
    transportadora: "Correios",
    nfNumero: "12345",
    destinatarioNome: "Fulano",
  });
  assert.deepEqual(Object.keys(out).sort(), [
    "blocoId",
    "destinatarioNome",
    "nfNumero",
    "transportadora",
    "unidadeId",
  ]);
});

test("sanitizeAiOutput: descarta campos inesperados que a IA possa retornar", () => {
  const out: any = sanitizeAiOutput({
    unidadeId: "101",
    __proto__: { polluted: true },
    apiKey: "secret",
    cpf: "000.000.000-00",
    extra: "campo não solicitado",
  });
  assert.equal(out.apiKey, undefined);
  assert.equal(out.cpf, undefined);
  assert.equal(out.extra, undefined);
  assert.equal(out.unidadeId, "101");
});

test("sanitizeAiOutput: valores não-string viram null (nunca propaga tipo inesperado)", () => {
  const out = sanitizeAiOutput({
    unidadeId: 101 as any,
    blocoId: { nested: true } as any,
    transportadora: null,
    nfNumero: undefined,
    destinatarioNome: "",
  });
  assert.equal(out.unidadeId, null);
  assert.equal(out.blocoId, null);
  assert.equal(out.transportadora, null);
  assert.equal(out.nfNumero, null);
  assert.equal(out.destinatarioNome, null);
});

test("sanitizeAiOutput: entrada não-objeto (null/string/array) não lança e retorna todos os campos null", () => {
  for (const bad of [null, undefined, "x", 42, []]) {
    const out = sanitizeAiOutput(bad);
    assert.equal(out.unidadeId, null);
    assert.equal(out.blocoId, null);
    assert.equal(out.transportadora, null);
    assert.equal(out.nfNumero, null);
    assert.equal(out.destinatarioNome, null);
  }
});
