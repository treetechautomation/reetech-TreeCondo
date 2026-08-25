/**
 * FEATURE.ANUNCIOS.1 — testes puros de src/lib/anuncios/attachment.ts.
 * Sem import de firebaseAdmin (nenhuma inicialização de Firebase).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ATTACHMENT_ALLOWED_TYPES,
  ATTACHMENT_MAX_BYTES,
  isAllowedAttachmentType,
  sanitizeFileName,
  buildAttachmentStoragePath,
} from "../attachment";

// B8 — tipo inválido.
test("isAllowedAttachmentType: aceita apenas a allowlist (imagens comuns + PDF)", () => {
  assert.equal(isAllowedAttachmentType("image/jpeg"), true);
  assert.equal(isAllowedAttachmentType("image/png"), true);
  assert.equal(isAllowedAttachmentType("image/webp"), true);
  assert.equal(isAllowedAttachmentType("application/pdf"), true);
});

test("isAllowedAttachmentType: rejeita tipos fora da allowlist (ex.: executável, zip, vídeo)", () => {
  assert.equal(isAllowedAttachmentType("application/x-msdownload"), false);
  assert.equal(isAllowedAttachmentType("application/zip"), false);
  assert.equal(isAllowedAttachmentType("video/mp4"), false);
  assert.equal(isAllowedAttachmentType(""), false);
});

// B9 — limite de tamanho é um valor real e razoável (documenta a política).
test("ATTACHMENT_MAX_BYTES: teto de 10MB", () => {
  assert.equal(ATTACHMENT_MAX_BYTES, 10 * 1024 * 1024);
});

test("ATTACHMENT_ALLOWED_TYPES: exatamente a allowlist documentada (imagens + PDF, sem tipos extras)", () => {
  assert.deepEqual([...ATTACHMENT_ALLOWED_TYPES].sort(), ["application/pdf", "image/jpeg", "image/png", "image/webp"]);
});

// B10 — path é sempre tenant-scoped por construção.
test("buildAttachmentStoragePath: path sempre começa com condominios/{condominioId}/anuncios/{anuncioId}/", () => {
  const p = buildAttachmentStoragePath("cond-A", "anun-1", "cartaz.png");
  assert.match(p, /^condominios\/cond-A\/anuncios\/anun-1\//);
});

test("buildAttachmentStoragePath: dois uploads do mesmo arquivo geram paths distintos (não colide com anexo anterior)", () => {
  const p1 = buildAttachmentStoragePath("cond-A", "anun-1", "cartaz.png");
  const p2 = buildAttachmentStoragePath("cond-A", "anun-1", "cartaz.png");
  assert.notEqual(p1, p2);
});

test("buildAttachmentStoragePath: dois condomínios diferentes nunca compartilham prefixo de path (isolamento de tenant)", () => {
  const pA = buildAttachmentStoragePath("cond-A", "anun-1", "x.png");
  const pB = buildAttachmentStoragePath("cond-B", "anun-1", "x.png");
  assert.notEqual(pA.split("/")[1], pB.split("/")[1]);
  assert.ok(pA.startsWith("condominios/cond-A/"));
  assert.ok(pB.startsWith("condominios/cond-B/"));
});

// B11 — nome de arquivo hostil não escapa do path nem injeta segmentos.
// A propriedade de segurança real é "nenhum separador de path sobrevive" —
// sem "/", ".." deixa de ser travessia de diretório, é só texto no nome.
test("sanitizeFileName: remove separadores de path (../, \\) — nenhum '/' sobrevive", () => {
  const s = sanitizeFileName("../../etc/passwd");
  assert.equal(s.includes("/"), false);
  assert.equal(s.includes("\\"), false);
});

test("sanitizeFileName: nome vazio cai no fallback; nome só-símbolos permanece não-vazio", () => {
  assert.equal(sanitizeFileName(""), "arquivo");
  assert.ok(sanitizeFileName("???").length > 0);
});

test("buildAttachmentStoragePath: nome de arquivo hostil não altera o prefixo tenant-scoped do path", () => {
  const p = buildAttachmentStoragePath("cond-A", "anun-1", "../../../secret.png");
  assert.match(p, /^condominios\/cond-A\/anuncios\/anun-1\//);
  // apenas um segmento de path após o prefixo (nenhuma travessia de diretório)
  const rest = p.slice("condominios/cond-A/anuncios/anun-1/".length);
  assert.equal(rest.includes("/"), false);
});
