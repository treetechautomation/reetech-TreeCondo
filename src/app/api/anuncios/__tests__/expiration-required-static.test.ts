/**
 * FEATURE.ANUNCIOS.1 — validação estática de expiração obrigatória em
 * POST /api/anuncios e PUT /api/anuncios/[anuncioId].
 *
 * Segue o padrão estabelecido em
 * src/app/api/reservas/__tests__/criar-apiguard-reconciliation.test.ts:
 * verificação estática do código-fonte real, necessária porque estas rotas
 * inicializam firebase-admin no import (sem mock de módulo ESM disponível
 * no test runner deste projeto — ver firebase-admin-project-selection.test.ts).
 * A lógica pura de decisão (requiresExpiresAt/readDateFlexible) já tem
 * cobertura comportamental real em src/lib/anuncios/__tests__/expiration.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const POST_ROUTE = path.resolve(__dirname, "../route.ts");
const PUT_ROUTE = path.resolve(__dirname, "../[anuncioId]/route.ts");

async function read(p: string) { return fs.readFile(p, "utf8"); }

// A1/A2 — create/publicar e agendar sem expiração => reject.
test("POST /api/anuncios: requiresExpiresAt(status) bloqueia PUBLICADO/AGENDADO sem expiresAt válido", async () => {
  const src = await read(POST_ROUTE);
  // FIX.ANUNCIOS.2A.1: POST não importa mais readDateFlexible — expiresAt
  // agora é parseado com parseZonedDateTimeLocal (contrato de timezone
  // explícito), ver src/app/api/anuncios/__tests__/scheduling-static.test.ts.
  assert.match(src, /import \{ requiresExpiresAt \} from "@\/lib\/anuncios\/expiration";/);
  assert.match(src, /if \(requiresExpiresAt\(status\)\) \{\s*\n\s*if \(!expiresAtParsed\) return jsonError\("Expiração é obrigatória/);
});

// A4 — expiração passada é rejeitada para PUBLICADO/AGENDADO.
test("POST /api/anuncios: expiração no passado é rejeitada quando status exige expiração", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /expiresAtParsed\.getTime\(\) <= Date\.now\(\)\) return jsonError\("Expiração deve ser uma data futura\."/);
});

// A3 — formato inválido é rejeitado antes mesmo de checar obrigatoriedade.
test("POST /api/anuncios: expiresAt presente mas não-parseável é rejeitado (Expiração inválida)", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /if \(!expiresAtParsed\) return jsonError\("Expiração inválida\."/);
});

// A6 — RASCUNHO não exige expiração: a checagem só roda dentro de
// requiresExpiresAt(status), que exclui RASCUNHO (comportamento comprovado
// em expiration.test.ts) — aqui provamos que a rota não tem NENHUM outro
// bloqueio incondicional de expiresAt fora desse guard.
test("POST /api/anuncios: única checagem de obrigatoriedade de expiresAt está dentro de requiresExpiresAt(status)", async () => {
  const src = await read(POST_ROUTE);
  const mandatoryChecks = src.match(/return jsonError\("Expiração é obrigatória[^)]*\)/g) || [];
  assert.equal(mandatoryChecks.length, 1, "deve haver exatamente um ponto de rejeição por obrigatoriedade");
});

// A5 — expiração válida: escrita ocorre depois de toda a validação, usando o
// valor parseado (não a string crua do cliente).
test("POST /api/anuncios: grava expiresAt como Timestamp a partir do valor validado (expiresAtParsed)", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /expiresAt: expiresAtParsed \? Timestamp\.fromDate\(expiresAtParsed\) : null,/);
  const validationIdx = src.indexOf("requiresExpiresAt(status)");
  const writeIdx = src.indexOf("await ref.set(data)");
  assert.ok(validationIdx > 0 && writeIdx > validationIdx, "validação deve ocorrer antes da escrita");
});

// F23-28 — regressão: nenhum dos caminhos existentes foi removido.
test("POST /api/anuncios: regressão — CONDOMINIO/BLOCO, PUBLICADO/AGENDADO/RASCUNHO continuam presentes", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /\["CONDOMINIO", "BLOCO"\]\.includes\(targetScope\)/);
  assert.match(src, /\["RASCUNHO", "AGENDADO", "PUBLICADO"\]\.includes\(status\)/);
  assert.match(src, /status === "AGENDADO" && !publishAt/);
  assert.match(src, /status === "PUBLICADO"/);
});

// --- PUT /api/anuncios/[anuncioId] ---

test("PUT [anuncioId]: valida expiração apenas quando status ou expiresAt são explicitamente tocados", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /const statusProvided = body\.status !== undefined;/);
  assert.match(src, /const expiresAtProvided = body\.expiresAt !== undefined;/);
  assert.match(src, /requiresExpiresAt\(effectiveStatus\) && \(statusProvided \|\| expiresAtProvided\)/);
});

test("PUT [anuncioId]: expiração ausente (nem no request, nem no doc atual) é rejeitada quando efetivamente PUBLICADO/AGENDADO", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /const effectiveExpiresAt = expiresAtProvided \? expiresAtParsed : readDateFlexible\(currentData\.expiresAt\);/);
  assert.match(src, /if \(!effectiveExpiresAt\) return jsonError\("Expiração é obrigatória/);
});

test("PUT [anuncioId]: expiração no passado rejeitada apenas quando recém-fornecida nesta requisição", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /if \(expiresAtProvided && expiresAtParsed && requiresExpiresAt\(effectiveStatus\) && expiresAtParsed\.getTime\(\) <= Date\.now\(\)\)/);
});

test("PUT [anuncioId]: edição que não toca status nem expiresAt não é bloqueada por essa regra (evita regressão em anúncios legados)", async () => {
  const src = await read(PUT_ROUTE);
  // A checagem de obrigatoriedade é condicionada a (statusProvided ||
  // expiresAtProvided) — uma edição de apenas título/mensagem não passa
  // por nenhum dos dois, então nunca entra no bloco de rejeição.
  const guardLine = src.match(/if \(requiresExpiresAt\(effectiveStatus\) && \(statusProvided \|\| expiresAtProvided\)\) \{/);
  assert.ok(guardLine, "guard de obrigatoriedade deve exigir toque explícito em status ou expiresAt");
});

test("PUT [anuncioId]: regressão — archive/restore/titulo/mensagem/targetScope continuam intactos", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /body\.action === "archive"/);
  assert.match(src, /body\.action === "restore"/);
  assert.match(src, /if \(body\.titulo !== undefined\)/);
  assert.match(src, /if \(body\.targetScope !== undefined\)/);
});
