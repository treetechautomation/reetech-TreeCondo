/**
 * ADMIN_CONDOMINIO.1C-R2 — PRIMEIRO ACESSO POR LINK (ADMIN_CONDOMINIO/SINDICO)
 *
 * Decisão arquitetural: para ADMIN_CONDOMINIO e SINDICO, o primeiro acesso
 * acontece exclusivamente pelo link/código de convite. Nenhuma senha
 * temporária utilizável é criada, enviada por e-mail, logada ou retornada
 * pela API para esses dois perfis.
 *
 * Estes testes seguem o padrão já estabelecido no gate 1C (K/L) de
 * verificação estática do código-fonte real, já que os handlers dependem
 * de Firestore/Auth via Admin SDK e este projeto não usa mocking framework
 * (ver f25-self-onboarding.test.ts, f13-membership-integrity.test.ts).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const CREATE_ROUTE = path.resolve(__dirname, "../create/route.ts");
const FINALIZE_ROUTE = path.resolve(__dirname, "../finalizar-primeiro-acesso/route.ts");
const PRIMEIRO_ACESSO_PAGE = path.resolve(__dirname, "../../../primeiro-acesso/page.tsx");

async function readSrc(p: string) {
  return fs.readFile(p, "utf8");
}

// A/B — ADMIN_CONDOMINIO e SINDICO novos: nenhuma senha é gerada/enviada.

test("A/B ADMIN_CONDOMINIO e SINDICO são tratados como isLinkOnlyRole (sem senha)", async () => {
  const src = await readSrc(CREATE_ROUTE);
  assert.match(
    src,
    /isLinkOnlyRole\s*=\s*targetRole\s*===\s*"ADMIN_CONDOMINIO"\s*\|\|\s*targetRole\s*===\s*"SINDICO"/,
    "deve existir a flag isLinkOnlyRole cobrindo exatamente ADMIN_CONDOMINIO e SINDICO"
  );
  // createUser SEM password deve existir dentro do branch isLinkOnlyRole
  const linkOnlyBranch = src.match(/if \(isLinkOnlyRole\) \{[\s\S]*?\n\s*\} else \{/);
  assert.ok(linkOnlyBranch, "deve existir um branch condicional para isLinkOnlyRole na criação do Auth user");
  assert.equal(
    /password/.test(linkOnlyBranch![0]),
    false,
    "createUser() dentro do branch isLinkOnlyRole não deve incluir password"
  );
});

test("outros perfis (MORADOR, PORTEIRO, ZELADOR, FUNCIONARIO, ADMIN) mantêm o comportamento do gate 1C", async () => {
  const src = await readSrc(CREATE_ROUTE);
  const elseBranch = src.match(/\} else \{[\s\S]*?senhaTemporaria = randomPassword\(10\);[\s\S]*?\n\s*\}\n\s*\}/);
  assert.ok(elseBranch, "deve existir o branch else preservando randomPassword(10) para os demais perfis");
});

// C/D — Auth já existente: nenhuma senha é tocada, independente do perfil.

test("C/D Auth existente reaproveitado não gera nem altera senha (nenhum perfil)", async () => {
  const src = await readSrc(CREATE_ROUTE);
  const tryBlock = src.match(/try \{\s*const existing = await aauth\.getUserByEmail\(email\);[\s\S]*?existingAccountReused = true;\s*\} catch \{/);
  assert.ok(tryBlock, "branch de reaproveitamento de Auth existente deve existir");
  assert.equal(
    /password/i.test(tryBlock![0]),
    false,
    "reaproveitar um Auth existente não deve envolver senha alguma"
  );
});

// E/F/G/H/I — finalizar-primeiro-acesso continua sendo o único ponto que
// ativa membro/vínculo/convite (inalterado neste gate, exceto pela adição
// da checagem de expiração).

test("E-I finalizar-primeiro-acesso continua criando vinculo ATIVO + membro ATIVO + convite CONCLUIDO", async () => {
  const src = await readSrc(FINALIZE_ROUTE);
  assert.match(src, /status:\s*"ATIVO"/, "vinculo/membro devem continuar sendo marcados ATIVO");
  assert.match(src, /status:\s*"CONCLUIDO"/, "convite deve continuar sendo marcado CONCLUIDO");
  assert.match(src, /userCondominios[\s\S]*\.collection\("vinculos"\)\.doc\(condominioId\)/);
});

// J/K — login posterior vai para /painel; convite concluído não retorna ao
// primeiro acesso (idempotência já provada no gate 1C via identityResolver
// ACTIVE_LINKED_USER; aqui confirmamos que finalizar-primeiro-acesso
// continua com o early-return idempotente).

test("K convite CONCLUIDO/ACEITO retorna cedo sem re-executar a transação", async () => {
  const src = await readSrc(FINALIZE_ROUTE);
  const idempotentReturn = src.match(/if \(status === "CONCLUIDO" \|\| status === "ACEITO"\) \{[\s\S]*?alreadyDone: true[\s\S]*?\}/);
  assert.ok(idempotentReturn, "early return idempotente para convite já concluído deve existir");
});

// L — convite expirado é rejeitado (gap encontrado neste gate: a checagem
// existia em validar-codigo mas nunca em finalizar-primeiro-acesso, que é
// o endpoint realmente usado pela UI).

test("L convite expirado é rejeitado por finalizar-primeiro-acesso", async () => {
  const src = await readSrc(FINALIZE_ROUTE);
  assert.match(
    src,
    /expiresAt[\s\S]{0,80}toMillis\(\)\s*<\s*Date\.now\(\)/,
    "deve existir checagem de expiresAt.toMillis() < Date.now()"
  );
  assert.match(src, /expirou/i, "deve existir mensagem de erro para convite expirado");
});

// M — convite revogado: não existe status REVOGADO no schema atual
// (confirmado por auditoria: nenhuma escrita desse status em todo
// src/app/api/convites). Documentado como gap para gate futuro, não
// implementado aqui (fora do escopo de "patch mínimo").

test("M status BLOQUEADO (único status de bloqueio existente) é rejeitado", async () => {
  const src = await readSrc(FINALIZE_ROUTE);
  assert.match(src, /status === "BLOQUEADO"/, "deve existir checagem para status BLOQUEADO");
});

// N/O/P — convite de outro UID / cross-tenant / role adulterada: uid,
// condominioId e role SEMPRE vêm do documento de convite already
// server-resolved, nunca do body da requisição.

test("N/O/P uid, condominioId e role vêm exclusivamente do convite (nunca do body da requisição)", async () => {
  const src = await readSrc(FINALIZE_ROUTE);
  assert.match(src, /const uid = String\(convite\.uidGerado \|\| ""\)\.trim\(\)/);
  assert.match(src, /const condominioId = String\(convite\.condominioId \|\| ""\)\.trim\(\)/);
  assert.match(src, /const role = String\(convite\.tipo \|\| convite\.role \|\| ""\)\.toUpperCase\(\)/);

  // O body só deve contribuir email/code/senha — nunca uid/condominioId/role.
  const bodyType = src.match(/const body = \(await req\.json\(\).*?\) as \{[\s\S]*?\};/);
  assert.ok(bodyType);
  assert.equal(/uid|condominioId|role/.test(bodyType![0]), false, "body tipado não deve aceitar uid/condominioId/role do cliente");
});

// Q — senha temporária não aparece mais no e-mail para NENHUM perfil
// (mantém a garantia do gate 1C, source check já existente removido daqui
// para evitar duplicação com identityResolver.test.ts K; reconfirmado aqui
// porque o template do e-mail foi reescrito neste gate).

test("Q e-mail não exibe senha temporária (template reescrito neste gate)", async () => {
  const src = await readSrc(CREATE_ROUTE);
  assert.equal(/Senha temporária/.test(src), false);
  assert.equal(/<code>\$\{senhaTemporaria\}/.test(src), false);
});

// R — link do e-mail usa `code`, não `conviteId` (o parâmetro anterior
// nunca era lido pela página real).

test("R primeiroAcessoUrl usa o parâmetro `code`, não `conviteId`", async () => {
  const src = await readSrc(CREATE_ROUTE);
  assert.match(src, /primeiro-acesso\?code=\$\{encodeURIComponent\(inviteCode\)\}/);
  assert.equal(/primeiro-acesso\?conviteId=/.test(src), false);
});

test("R /primeiro-acesso/page.tsx realmente lê o parâmetro `code` (prova da rota real)", async () => {
  const src = await readSrc(PRIMEIRO_ACESSO_PAGE);
  assert.match(src, /sp\?\.get\("code"\)/);
  assert.equal(/sp\?\.get\("conviteId"\)/.test(src), false);
});

// S/T — MORADOR self-onboarding e SUPER_ADMIN preservados: nenhuma destas
// rotas foi tocada por este gate (eligible-links, create-access-link,
// vincular-condominio, isSuper checks) — confirmado por não estarem entre
// os arquivos modificados (ver relatório do gate para o diff completo).
