/**
 * P1.0 — ETAPA 7B — TESTES — personId seguro em Convites (P1-2)
 *
 * `POST /api/convites/create` usa Firebase Admin SDK diretamente (adminDb/adminAuth)
 * sem injeção de dependência — não é testável via mock de Firestore sem alterar a
 * arquitetura da rota (fora do escopo de "patch mínimo" desta etapa). Os testes abaixo
 * são guardas de regressão estruturais sobre o código-fonte real, verificando por
 * inspeção exata que:
 *   (a) o vetor inseguro antigo (personId aceito cegamente do client) foi removido;
 *   (b) a derivação segura substituta está presente e escopada por condominioId;
 *   (c) nenhum campo de autorização (role/status/bloco/unidade) foi alterado.
 * Validação funcional real (CASO 8/9/10) depende de credenciais Firestore
 * indisponíveis neste ambiente — mesma limitação documentada nas Etapas 3-7A.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readCreateRouteSource(): string {
  return readFileSync(join(__dirname, "..", "create", "route.ts"), "utf-8");
}

// ════════════ CASO 8 — Convite associa Pessoa canônica existente → personId derivado ════════════

test("CASO 8 — personId é derivado por busca de Pessoa canônica (emailNorm+status ATIVO), não do client", () => {
  const src = readCreateRouteSource();
  assert.ok(
    /collection\("pessoas"\)\s*\n?\s*\.where\("emailNorm",\s*"==",\s*email\)\s*\n?\s*\.where\("status",\s*"==",\s*"ATIVO"\)/.test(src),
    "deve existir busca de pessoa canônica por emailNorm+status ATIVO antes de gravar personId",
  );
  assert.match(src, /personId:\s*resolvedPersonId,\s*status:\s*"PENDENTE"/, "o membro deve ser gravado com o personId derivado (resolvedPersonId)");
});

// ════════════ CASO 9 — Convite sem Pessoa associável → não inventa personId ════════════

test("CASO 9 — resolvedPersonId inicia null e só é setado se uma Pessoa real for encontrada (nunca inventado)", () => {
  const src = readCreateRouteSource();
  assert.match(src, /let resolvedPersonId: string \| null = null;/, "resolvedPersonId deve iniciar null (nenhuma Pessoa inventada por padrão)");
  // Não deve haver nenhuma escrita (.set/.add) na coleção pessoas dentro deste arquivo —
  // convites/create nunca cria uma Pessoa, só localiza uma já existente.
  assert.ok(!/collection\("pessoas"\)[\s\S]{0,200}\.set\(/.test(src), "convites/create não deve criar/escrever em pessoas/{id}");
});

// ════════════ CASO 10 — personId de outro condomínio → rejeitado/nunca persistido ════════════

test("CASO 10 — o vetor inseguro antigo (body.personId aceito cegamente) foi removido", () => {
  const src = readCreateRouteSource();
  // Verifica o padrão de código inseguro específico que existia antes do patch —
  // não a string livre "body.personId", que ainda aparece descritivamente em comentário.
  assert.ok(!/personId:\s*body\.personId/.test(src), "o padrão antigo `personId: body.personId || null` não deve mais existir");
  assert.ok(!/\bbody\.personId\b/.test(src.replace(/\/\/.*$/gm, "")), "body.personId não deve mais ser lido fora de comentários");
});

test("CASO 10b — a busca por Pessoa é sempre escopada a condominios/{condominioId}/pessoas (cross-tenant impossível por path)", () => {
  const src = readCreateRouteSource();
  assert.match(
    src,
    /collection\("condominios"\)\.doc\(condominioId\)\s*\n?\s*\.collection\("pessoas"\)/,
    "a query de pessoa por e-mail deve estar aninhada sob o condominioId da própria requisição",
  );
});

// ════════════ CASO 11 — role do membro permanece inalterada ════════════

test("CASO 11 — a lógica de determinação de role do membro não foi tocada pelo patch", () => {
  const src = readCreateRouteSource();
  assert.match(src, /const membroRole = isFuncionario \? "ZELADOR" : role;/);
  assert.match(src, /role:\s*membroRole,\s*tipo:\s*membroTipo,/);
});

// ════════════ CASO 12 — bloco/unidade/vínculo residencial permanecem inalterados ════════════

test("CASO 12 — campos de bloco/unidade do membro permanecem com a mesma lógica condicional de antes", () => {
  const src = readCreateRouteSource();
  assert.match(src, /blocoId:\s*blocoId\s*\?\?\s*null,/);
  assert.match(
    src,
    /unidadeId:\s*isFuncionario \? null : \(role === "MORADOR" \? \(resolvedUnidadeId \?\? null\) : null\),/,
  );
  assert.match(
    src,
    /unitDocId:\s*isFuncionario \? null : \(role === "MORADOR" \? \(unitDocId \?\? null\) : null\),/,
  );
});

// ════════════ Segurança geral — allowedRoles/hierarquia de convite intocada ════════════

test("allowedRoles do apiGuard e ALLOWED_TARGET_ROLES permanecem exatamente como antes do patch", () => {
  const src = readCreateRouteSource();
  assert.match(src, /allowedRoles:\s*\["SUPER_ADMIN",\s*"ADMIN_CONDOMINIO",\s*"ADMIN",\s*"SINDICO"\]/);
  assert.match(src, /SINDICO:\s*\["MORADOR",\s*"PORTEIRO",\s*"ZELADOR",\s*"FUNCIONARIO"\]/);
});
