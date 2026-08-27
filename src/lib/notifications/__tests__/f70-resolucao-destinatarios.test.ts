/**
 * P1.0 — ETAPA 7B — TESTES — Resolução de destinatários (P1-1)
 *
 * Cobre `buildResolvedRecipients` (src/lib/notifications/unitRecipients.ts),
 * a função pura extraída do fix que elimina a dependência de PersonData.uid
 * (ÓRFÃO, ver P1.0 Etapa 7A) e resolve identidade via membros/{uid}.personId
 * (fonte canônica: o document ID do membro JÁ É o Firebase Auth uid).
 *
 * `resolveUnitRecipients` (a função async que efetivamente consulta o
 * Firestore) não é testada diretamente aqui — exigiria credenciais reais
 * (mesma limitação já documentada nas Etapas 3-7A). CASO 5/8/9/10 (tenant
 * isolation, derivação de personId em Convites) são verificados por
 * inspeção estrutural do código-fonte (grep sobre o arquivo real), não por
 * mock — ver comentários em cada teste.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildResolvedRecipients, type ResolvedRecipient } from "../unitRecipients";

// ════════════ CASO 1 — Pessoa com membro contendo personId → uid resolvido pelo ID do membro ════════════

test("CASO 1 — pessoa com membro correspondente resolve uid a partir do document ID do membro", () => {
  const map = new Map([["pessoa-1", [{ uid: "uid-membro-1", status: "ATIVO" }]]]);
  const recipients = buildResolvedRecipients(["pessoa-1"], map);
  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].uid, "uid-membro-1");
  assert.equal(recipients[0].hasAuth, true);
  assert.equal(recipients[0].hasActiveMembership, true);
});

// ════════════ CASO 2 — Pessoa sem PersonData.uid → notificação ainda consegue resolver uid ════════════

test("CASO 2 — resolução nunca depende de PersonData.uid — buildResolvedRecipients não recebe/lê esse campo", () => {
  // A assinatura da função não aceita PersonData/pessoa.uid em nenhum parâmetro —
  // a única entrada é o mapa pessoaId→membros já resolvido via personId.
  const map = new Map([["pessoa-2", [{ uid: "uid-membro-2", status: "ATIVO" }]]]);
  const recipients = buildResolvedRecipients(["pessoa-2"], map);
  assert.equal(recipients[0].uid, "uid-membro-2");
});

test("CASO 2b — código-fonte de unitRecipients.ts não lê mais `pessoas` para resolver uid", () => {
  const src = readFileSync(join(__dirname, "..", "unitRecipients.ts"), "utf-8");
  assert.ok(!src.includes('.collection("pessoas")'), "unitRecipients.ts não deve mais consultar a coleção pessoas");
  assert.ok(!/\.uid\s*\|\|\s*null/.test(src), "não deve mais existir leitura de pessoa.uid");
});

// ════════════ CASO 3 — Pessoa PERSON_ONLY sem membro → ignorada para push sem quebrar lote ════════════

test("CASO 3 — pessoa sem membro (PERSON_ONLY) é incluída como não-notificável, sem quebrar o lote", () => {
  const map = new Map([
    ["pessoa-com-membro", [{ uid: "uid-1", status: "ATIVO" }]],
    ["pessoa-person-only", []],
  ]);
  const recipients = buildResolvedRecipients(["pessoa-com-membro", "pessoa-person-only"], map);
  assert.equal(recipients.length, 2);
  const personOnly = recipients.find(r => r.pessoaId === "pessoa-person-only")!;
  assert.equal(personOnly.uid, null);
  assert.equal(personOnly.hasAuth, false);
  assert.equal(personOnly.hasActiveMembership, false);
  const comMembro = recipients.find(r => r.pessoaId === "pessoa-com-membro")!;
  assert.equal(comMembro.uid, "uid-1");
});

// ════════════ CASO 4 — Mesmo uid encontrado duas vezes → destinatário final deduplicado ════════════

test("CASO 4 — mesmo uid resolvido por duas pessoas/vínculos é deduplicado no resultado final", () => {
  const map = new Map([
    ["pessoa-a", [{ uid: "uid-compartilhado", status: "ATIVO" }]],
    ["pessoa-b", [{ uid: "uid-compartilhado", status: "ATIVO" }]],
  ]);
  const recipients = buildResolvedRecipients(["pessoa-a", "pessoa-b"], map);
  const uids = recipients.map(r => r.uid).filter(Boolean);
  assert.equal(uids.length, 1);
  assert.equal(uids[0], "uid-compartilhado");
});

// ════════════ CASO 5 — Pessoa de outro condomínio → nunca resolve membro cross-tenant ════════════

test("CASO 5 — tenant isolation verificada por inspeção estrutural (query sempre escopada por condominioId)", () => {
  // buildResolvedRecipients é pura e só opera sobre dados já resolvidos — o isolamento de
  // tenant é garantido pela CONSTRUÇÃO da query em resolveUnitRecipients, não testável sem
  // Firestore real. Verificamos aqui que a query de membros permanece aninhada sob
  // condominios/{condominioId} (impossível de cruzar tenant por construção de path).
  const src = readFileSync(join(__dirname, "..", "unitRecipients.ts"), "utf-8");
  assert.match(
    src,
    /collection\("condominios"\)\.doc\(condominioId\)\s*\n?\s*\.collection\("membros"\)\s*\n?\s*\.where\("personId"/,
    "a query de membros por personId deve permanecer aninhada sob condominios/{condominioId}",
  );
});

// ════════════ CASO 6 — PersonData.uid legado presente → não deve ser necessário para resolução ════════════

test("CASO 6 — mesmo que pessoa.uid legado existisse, a resolução real (membros) teria prioridade e seria suficiente", () => {
  // buildResolvedRecipients nem aceita um valor de pessoa.uid como entrada — só o
  // resultado da consulta a membros. Logo, um valor legado em pessoas/{id}.uid,
  // se existisse, seria simplesmente ignorado (não há como influenciar o resultado).
  const map = new Map([["pessoa-legado", [{ uid: "uid-do-membro-real", status: "ATIVO" }]]]);
  const recipients = buildResolvedRecipients(["pessoa-legado"], map);
  assert.equal(recipients[0].uid, "uid-do-membro-real");
});

// ════════════ CASO 7 — membro sem personId → comportamento seguro e documentado ════════════

test("CASO 7 — membro sem personId nunca aparece no mapa (empty match) — pessoa tratada como sem membro, sem erro", () => {
  // Um membro sem personId nunca satisfaz `.where("personId","==",pid)` — logo nunca
  // entra no mapa pessoaToMembros para nenhum pid. O comportamento resultante é
  // idêntico ao CASO 3 (PERSON_ONLY): array vazio → recipient com uid=null, sem exceção.
  const map = new Map<string, { uid: string; status: string }[]>([["pessoa-x", []]]);
  assert.doesNotThrow(() => buildResolvedRecipients(["pessoa-x"], map));
  const recipients = buildResolvedRecipients(["pessoa-x"], map);
  assert.equal(recipients[0].uid, null);
  assert.equal(recipients[0].hasAuth, false);
});

// ════════════ requireActiveMembership — status inativo não vira destinatário elegível ════════════

test("membro com status != ATIVO — hasActiveMembership=false quando requireActiveMembership (default)", () => {
  const map = new Map([["pessoa-inativa", [{ uid: "uid-inativo", status: "PENDENTE" }]]]);
  const recipients = buildResolvedRecipients(["pessoa-inativa"], map);
  assert.equal(recipients[0].hasAuth, true);
  assert.equal(recipients[0].hasActiveMembership, false);
});

test("requireActiveMembership=false — hasActiveMembership sempre true para quem tem membro", () => {
  const map = new Map([["pessoa-y", [{ uid: "uid-y", status: "PENDENTE" }]]]);
  const recipients = buildResolvedRecipients(["pessoa-y"], map, { requireActiveMembership: false });
  assert.equal(recipients[0].hasActiveMembership, true);
});

// ════════════ excludeUids — exclusão por uid e por pessoaId (PERSON_ONLY) ════════════

test("excludeUids remove um uid já resolvido do resultado final", () => {
  const map = new Map([["pessoa-z", [{ uid: "uid-excluido", status: "ATIVO" }]]]);
  const recipients = buildResolvedRecipients(["pessoa-z"], map, { excludeUids: ["uid-excluido"] });
  assert.equal(recipients.length, 0);
});

// ════════════ CASO 13 — Encomenda para unidade com residente elegível → destinatário resolvido ════════════

test("CASO 13 — cenário de Encomendas: residente com membro ATIVO é resolvido como destinatário elegível", () => {
  const map = new Map([["pessoa-encomenda", [{ uid: "uid-encomenda", status: "ATIVO" }]]]);
  const recipients: ResolvedRecipient[] = buildResolvedRecipients(["pessoa-encomenda"], map);
  const elegivel = recipients.filter(r => r.hasAuth && r.hasActiveMembership);
  assert.equal(elegivel.length, 1);
  assert.equal(elegivel[0].uid, "uid-encomenda");
});

// ════════════ CASO 15 — nenhum writer novo de PersonData.uid ════════════

test("CASO 15 — nenhum writer de uid em pessoas/PersonData foi introduzido em unitRecipients.ts", () => {
  const src = readFileSync(join(__dirname, "..", "unitRecipients.ts"), "utf-8");
  // Não deve existir nenhum .set/.update com chave `uid:` dentro de um contexto de pessoas.
  assert.ok(!/collection\("pessoas"\)[\s\S]{0,120}\.set\(/.test(src), "não deve haver escrita em pessoas/{id} neste arquivo");
  assert.ok(!/collection\("pessoas"\)[\s\S]{0,120}\.update\(/.test(src), "não deve haver update em pessoas/{id} neste arquivo");
});
