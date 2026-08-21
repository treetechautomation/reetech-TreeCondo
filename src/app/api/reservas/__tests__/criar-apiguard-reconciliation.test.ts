/**
 * SECURITY.P0.11R — reservas/criar apiGuard reconciliation.
 *
 * Segue o padrão já estabelecido no projeto de verificação estática do
 * código-fonte real para rotas que dependem de Firestore/Auth via Admin SDK
 * (ver first-access-link-flow.test.ts, apiGuard-unitA.test.ts). O
 * comportamento funcional do policy engine, janela de horário e demais
 * regras de negócio já é coberto pela suíte src/lib/reservas/policy-engine/__tests__/*;
 * este arquivo cobre especificamente o que a reconciliação do P0.11R mudou
 * (a integração com apiGuard) e prova que nada além disso mudou.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const ROUTE = path.resolve(__dirname, "../criar/route.ts");
const CANON_SHA = "b3ce4e3509fa785367d628ed3ed1b98a31dc73f9";

async function readSrc() {
  return fs.readFile(ROUTE, "utf8");
}

const REPO_ROOT = path.resolve(__dirname, "../../../../..");

function readCanonSrc(): string {
  return execSync(`git show ${CANON_SHA}:src/app/api/reservas/criar/route.ts`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

// 1 — request não autenticado rejeitado (apiGuard default requireAuth=true,
// no override to false anywhere in this route).

test("1 rota não declara requireAuth:false — request não autenticado é rejeitado por apiGuard", async () => {
  const src = await readSrc();
  assert.match(src, /apiGuard\(\{\s*request:\s*req,\s*condominioId\s*\}\)/, "deve chamar apiGuard com condominioId");
  assert.equal(/requireAuth:\s*false/.test(src), false, "rota de criação de reserva não deve ser pública");
});

// 2 — usuário de outro condomínio rejeitado: apiGuard recebe condominioId e
// apenas resolve vínculo/membro dentro desse tenant (ver apiGuard.ts).

test("2 apiGuard recebe condominioId do body validado (tenant scoping delegado ao apiGuard)", async () => {
  const src = await readSrc();
  const guardIdx = src.indexOf("apiGuard({");
  const condIdx = src.indexOf("const condominioId", 0);
  assert.ok(condIdx > 0 && guardIdx > condIdx, "condominioId deve ser resolvido do body antes de apiGuard ser chamado");
});

// 3 — role não autorizada rejeitada: a checagem isOperador (para reserva em
// nome de outro morador) continua presente e usa actorIsSuperAdmin, não uma
// releitura direta de claims do token.

test("3 checagem isOperador (reserva em nome de outro morador) preservada e usa actorIsSuperAdmin", async () => {
  const src = await readSrc();
  assert.match(src, /const isOperador =\s*\n\s*isOperatorRole\(actorRole\)\s*\|\|\s*\n\s*actorIsSuperAdmin;/);
  assert.match(src, /if \(!isOperador\) \{\s*\n\s*return jsonError\("Sem permissão para criar reserva para outro morador\."/);
});

// 4 — usuário autorizado continua criando reserva: os três caminhos de
// escrita (composto, com_campo, simples) permanecem intactos.

test("4 os três caminhos de criação (composto/com_campo/simples) permanecem presentes", async () => {
  const src = await readSrc();
  assert.match(src, /if \(isCompound\) \{/);
  assert.match(src, /if \(opcaoId === "com_campo"\) \{/);
  assert.match(src, /return \{ mode: "FILA", slotId, filaCount: filaCount \+ 1 \}/);
  assert.match(src, /return \{ mode: "RESERVA", slotId, reservaId: reservaRef\.id \}/);
});

// 5 — timezone preservado.

test("5 timezone America/Sao_Paulo preservado (bloqueio de data passada + hora civil)", async () => {
  const src = await readSrc();
  assert.match(src, /todayInSaoPaulo\(\)/);
  assert.match(src, /timeZone:\s*"America\/Sao_Paulo"/);
  assert.match(src, /isoNoonUTC\(/, "evita virar o dia por fuso do servidor");
});

// 6 — schedule-window preservado (checagem de horário de exclusividade do
// Campo, incluindo o corte após início da faixa no dia corrente).

test("6 schedule-window (janela de exclusividade do Campo) preservado", async () => {
  const src = await readSrc();
  assert.match(src, /exc\.horaInicio \* 60/);
  assert.match(src, /exc\.horaFim \* 60/);
  assert.match(src, /nowHr >= exc\.horaInicio/);
});

// 7 — bloqueios preservados (revalidação transacional via checkReservaBlockTx).

test("7 revalidação transacional de bloqueios administrativos (R4.1) preservada", async () => {
  const src = await readSrc();
  assert.match(src, /checkReservaBlockTx\(tx, db, \{/);
  assert.match(src, /if \(blockCheck\.blocked\) \{/);
});

// 8 — convidados/ledger: não aplicável a este arquivo (não referenciado
// aqui; coberto por src/lib/reservas/policy-engine/__tests__/convidados-ledger.test.ts,
// que este gate não tocou).

test("8 rota não referencia ledger/convidados diretamente (fora de escopo deste arquivo)", async () => {
  const src = await readSrc();
  assert.equal(/ledger|convidados/i.test(src), false);
});

// 9 — fila preservada (limite de 3, criação de lock tipo FILA).

test("9 lógica de fila preservada (limite 3, lock tipo FILA)", async () => {
  const src = await readSrc();
  assert.match(src, /filaCount >= 3/);
  assert.match(src, /tipo: "FILA"/);
});

// 10 — policy engine preservado (getCompiledPolicy + validate no caminho
// com_campo).

test("10 policy engine (getCompiledPolicy/validate) preservado no caminho com_campo", async () => {
  const src = await readSrc();
  assert.match(src, /getCompiledPolicy\(repoLocal, \{ condominioId, areaId, opcaoId \}\)/);
  assert.match(src, /validate\("CREATE", compiled, policyCtx\)/);
});

// 11 — conflitos de horário continuam rejeitados (lock existente no slot).

test("11 conflito de horário/recurso já ocupado continua rejeitado", async () => {
  const src = await readSrc();
  assert.match(src, /Você já tem \$\{t === "FILA" \? "fila" : "reserva"\} em um dos recursos neste dia\./);
  assert.match(src, /Um ou mais recursos já estão ocupados neste dia\./);
});

// 12 — apiGuard não altera regra financeira: resolução de preço (valorCobrado)
// continua ocorrendo fora do apiGuard, e o cálculo em si não foi tocado por
// esta reconciliação (comparação direta contra o canonical).

test("12 resolução de valorCobrado idêntica ao canonical (apiGuard não altera regra financeira)", () => {
  const localSrc = require("node:fs").readFileSync(ROUTE, "utf8");
  const canonSrc = readCanonSrc();
  const extractPricing = (s: string) => {
    const start = s.indexOf("let valorCobrado: number;");
    const end = s.indexOf("// R2: Áreas de uso comum");
    return s.slice(start, end);
  };
  assert.equal(extractPricing(localSrc), extractPricing(canonSrc), "bloco de resolução de preço deve ser byte-idêntico ao canonical");
});

// 13 — erros não vazam informação sensível: catch final usa err?.message
// (nunca o objeto de erro bruto) e agora também repassa Response do apiGuard
// sem reformatá-la.

test("13 catch final não vaza objeto de erro bruto; repassa Response do apiGuard intacta", async () => {
  const src = await readSrc();
  const catchBlock = src.slice(src.lastIndexOf("} catch (err: any) {"));
  assert.match(catchBlock, /if \(err instanceof Response\) return err;/);
  assert.match(catchBlock, /String\(err\?\.message \|\| "Erro inesperado"\)/);
  assert.equal(/return jsonError\(err,/.test(catchBlock), false, "jsonError não deve receber o objeto de erro bruto");
});

// Extra — proves the specific bug this gate fixed: ctx.membroData (the
// CALLER's own membership) must never feed the reserva's target member
// resolution, since uid may be reassigned to targetUidBody.

test("EXTRA ctx.membroData não é usado para resolver bloco/unidade/pessoaId da reserva (evita atribuir dados do operador ao morador alvo)", async () => {
  const src = await readSrc();
  assert.equal(
    /[=(]\s*ctx\.membroData/.test(src),
    false,
    "membroPreSnap/membroSnap (releitura por uid) devem ser a única fonte de dados do membro-alvo — ctx.membroData não deve ser lido em nenhuma atribuição"
  );
  assert.match(src, /const membroPreSnap = await db\.collection\("condominios"\)\.doc\(condominioId\)\.collection\("membros"\)\.doc\(uid\)\.get\(\);/);
});

// Extra — proves apiGuard is wired before any Firestore write in this route.

test("EXTRA apiGuard é chamado antes de qualquer escrita/transação Firestore", async () => {
  const src = await readSrc();
  const guardIdx = src.indexOf("apiGuard({");
  const firstWriteIdx = src.indexOf("runTransaction(");
  assert.ok(guardIdx > 0 && firstWriteIdx > guardIdx);
});
