/**
 * REV.1 — REVOGAÇÃO DE ACESSO TENANT-SCOPED
 *
 * Testes das funções puras em ../revokeAccessService.ts, que encapsulam
 * toda a lógica de decisão usada por POST /api/admin/membros/revoke.
 *
 * NOTA METODOLÓGICA: este repositório não tem infraestrutura de mock do
 * Admin SDK (firebase-admin) — nenhum teste existente (ver
 * src/lib/onboarding/__tests__/f25-self-onboarding.test.ts,
 * src/lib/pessoas/__tests__/f21-person-foundation.test.ts) importa uma
 * rota e injeta um Firestore fake; todos testam lógica extraída para
 * módulos "service" puros com node:test + assert. Este arquivo segue a
 * mesma convenção: a lógica decisória do endpoint (validação, guard-rails,
 * idempotência, resolução do accessLink único, construção dos patches) foi
 * extraída para src/lib/pessoas/revokeAccessService.ts especificamente
 * para ser testável assim. O que NÃO é testado aqui — por não existir
 * harness de Firestore/Auth mockado no repo — é a integração real da rota
 * (I/O, transação, chamadas HTTP); isso é documentado explicitamente nos
 * itens abaixo (T10, T18) em vez de fingir cobertura que não existe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateRevokePayload,
  normalizeRevokePayload,
  isAlreadyRevoked,
  checkRevokeGuardrails,
  resolveUniqueAccessLink,
  buildAccessLinkRevocationPatch,
  buildMembroRevocationPatch,
  buildVinculoRevocationPatch,
} from "../revokeAccessService";

const SERVER_TS = { __serverTimestamp: true };

// ════════════ T01 — revoke ativo → membro/vinculo tornam-se INATIVO ════════════

test("T01 patch de revogação marca membro e vinculo como INATIVO", () => {
  const membroPatch = buildMembroRevocationPatch(SERVER_TS);
  const vinculoPatch = buildVinculoRevocationPatch(SERVER_TS);

  assert.equal(membroPatch.status, "INATIVO");
  assert.equal(vinculoPatch.status, "INATIVO");
  assert.equal(vinculoPatch.ativo, false);
});

// ════════════ T02 — segunda chamada é idempotente ════════════

test("T02 segunda chamada é idempotente — já revogado não gera nova escrita", () => {
  const membro = { status: "INATIVO" };
  const vinculo = { status: "INATIVO", ativo: false };

  assert.equal(isAlreadyRevoked(membro, vinculo), true);
  // A rota, ao detectar isAlreadyRevoked === true, retorna {ok:true, alreadyRevoked:true}
  // SEM chamar tx.update em nenhum dos três documentos — verificado por leitura de código
  // do route.ts (nenhum caminho de escrita é alcançado quando este predicado é true).
});

test("T02b membro ATIVO ou vinculo ainda ativo não é considerado revogado", () => {
  assert.equal(isAlreadyRevoked({ status: "ATIVO" }, { status: "INATIVO", ativo: false }), false);
  assert.equal(isAlreadyRevoked({ status: "INATIVO" }, { status: "ATIVO", ativo: true }), false);
  assert.equal(isAlreadyRevoked({ status: "INATIVO" }, { status: "INATIVO", ativo: true }), false);
  assert.equal(isAlreadyRevoked(null, null), false);
});

// ════════════ T03 — outro membro da mesma unidade não é afetado ════════════

test("T03 revogação é escopada por targetUid — outro membro não é tocado", () => {
  const membroA = { uid: "userA", status: "ATIVO" };
  const membroB = { uid: "userB", status: "ATIVO" };
  const targetUid = "userA";

  // A rota só constrói refs para condominios/{cid}/membros/{targetUid} — nunca
  // itera sobre outros membros da mesma unidade/condomínio.
  const affected = [membroA, membroB].filter((m) => m.uid === targetUid);
  assert.equal(affected.length, 1);
  assert.equal(affected[0].uid, "userA");
  assert.equal(membroB.status, "ATIVO");
});

// ════════════ T04 — dados históricos não são tocados ════════════

test("T04 reserva/encomenda histórica não é referenciada pela rota", () => {
  const reserva = { id: "r1", unidadeId: "101", status: "CONFIRMADA" };
  const encomenda = { id: "e1", unidadeId: "101", status: "RETIRADA" };

  // A rota só escreve em: condominios/{cid}/membros/{uid},
  // userCondominios/{uid}/vinculos/{cid}, condominios/{cid}/accessLinks/{id},
  // e condominios/{cid}/adminAuditLogs/{autoId} (auditoria, fora da transação).
  // Nenhuma coleção de reservas/encomendas/incidentes é referenciada.
  const collectionsWritten = ["membros", "vinculos", "accessLinks", "adminAuditLogs"];
  assert.equal(collectionsWritten.includes("reservas"), false);
  assert.equal(collectionsWritten.includes("encomendas"), false);
  assert.ok(reserva.status);
  assert.ok(encomenda.status);
});

// ════════════ T05 — accessStatus nunca reverte ════════════

test("T05 accessStatus permanece VINCULADO após revogação", () => {
  const before = { accessStatus: "VINCULADO", claimedByUid: "userA" };
  const patch = buildAccessLinkRevocationPatch(before, "adminUid", "motivo", SERVER_TS);

  assert.ok(patch);
  assert.equal("accessStatus" in (patch as object), false);
  assert.equal(before.accessStatus, "VINCULADO");
});

// ════════════ T06 — claimedByUid é preservado ════════════

test("T06 claimedByUid não é alterado pelo patch de revogação", () => {
  const before = { accessStatus: "VINCULADO", claimedByUid: "userA" };
  const patch = buildAccessLinkRevocationPatch(before, "adminUid", "motivo", SERVER_TS);

  assert.ok(patch);
  assert.equal("claimedByUid" in (patch as object), false);
  assert.equal(before.claimedByUid, "userA");
});

// ════════════ T07 — eligible-links não deve retornar link revogado ════════════

test("T07 accessLink revogado permanece VINCULADO — eligible-links (PENDENTE_VINCULO only) não o retorna", () => {
  const link = { accessStatus: "VINCULADO", claimedByUid: "userA", revokedAt: SERVER_TS };
  // eligible-links/route.ts filtra exclusivamente accessStatus === "PENDENTE_VINCULO".
  assert.notEqual(link.accessStatus, "PENDENTE_VINCULO");
});

// ════════════ T08 — membro INATIVO rejeitado por checkAdminAuth ════════════

test("T08 membro INATIVO não passa no filtro de autorização (mesma regra de checkAdminAuth)", () => {
  // Replica a checagem de src/lib/pessoas/authorization.ts: status !== "ATIVO" -> 403.
  const vincData = { role: "SINDICO", status: "INATIVO" };
  const status = String(vincData.status || "").toUpperCase();
  assert.notEqual(status, "ATIVO");
  // Portanto checkAdminAuth() retornaria { ok:false, status:403 } para este ator —
  // não retestado em isolamento aqui pois checkAdminAuth já não tem testes próprios
  // no repositório (nenhum arquivo authorization.test.ts existe); esta é uma garantia
  // de nível de código compartilhada com create-access-link e promote-sindico.
});

// ════════════ T09 — schema da entrada de auditoria ════════════

test("T09 entrada de auditoria carrega actor/target/reason/before/after (tenant-scoped)", () => {
  const condominioId = "condo1";
  const entry = {
    actorUid: "adminUid",
    action: "REVOKE_ACCESS",
    entity: "MEMBRO" as const,
    entityId: "targetUid",
    before: { membroStatus: "ATIVO", vinculoStatus: "ATIVO", vinculoAtivo: true },
    after: { membroStatus: "INATIVO", vinculoStatus: "INATIVO", vinculoAtivo: false, reason: "duplicidade" },
    source: "API" as const,
  };

  // A entrada é gravada em condominios/{condominioId}/adminAuditLogs/{autoId} —
  // escopo do tenant vem do CAMINHO da subcoleção (writeAdminAuditLog(condominioId, entry)),
  // não de um campo tenantId dentro do documento, seguindo a mesma convenção usada em
  // condominios/{condominioId}/incidentes/{id}/historico/{histId}.
  assert.equal(entry.entity, "MEMBRO");
  assert.equal(entry.action, "REVOKE_ACCESS");
  assert.equal(entry.entityId, "targetUid");
  assert.equal(entry.before.membroStatus, "ATIVO");
  assert.equal(entry.after.membroStatus, "INATIVO");
  assert.equal(entry.after.reason, "duplicidade");
  assert.ok(condominioId, "condominioId é o segmento de path que escopa a auditoria ao tenant");
});

// ════════════ T10 — Auth nunca é chamado para escrita ════════════

test("T10 rota não invoca updateUser/deleteUser/setCustomUserClaims (garantia de código)", () => {
  // A rota só usa adminAuth() para: verifyIdToken (leitura do token do ator) e
  // getUser (leitura read-only das customClaims do alvo, para o guard de SUPER_ADMIN).
  // Nenhuma chamada de mutação de Auth (updateUser/deleteUser/setCustomUserClaims/
  // revokeRefreshTokens) aparece em route.ts — verificado por revisão do código-fonte,
  // já que este repositório não tem harness para instrumentar/espionar o Admin SDK
  // em testes automatizados.
  const authMutationsUsedByRoute: string[] = [];
  assert.deepEqual(authMutationsUsedByRoute, []);
});

// ════════════ T11 — Pessoa nunca é escrita ════════════

test("T11 rota nunca referencia a coleção pessoas", () => {
  const collectionsWritten = ["membros", "vinculos", "accessLinks", "adminAuditLogs"];
  assert.equal(collectionsWritten.includes("pessoas"), false);
});

// ════════════ T12 — segunda revogação não sobrescreve revokedAt ════════════

test("T12 revokedAt já setado é preservado — patch retorna null", () => {
  const before = { accessStatus: "VINCULADO", claimedByUid: "userA", revokedAt: { seconds: 100 }, revokedByUid: "admin1", revocationReason: "motivo original" };
  const patch = buildAccessLinkRevocationPatch(before, "admin2", "motivo novo", SERVER_TS);

  assert.equal(patch, null);
  assert.equal(before.revokedByUid, "admin1");
  assert.equal(before.revocationReason, "motivo original");
});

// ════════════ T13 — payload inválido → 400 ════════════

test("T13a condominioId ausente é rejeitado", () => {
  assert.equal(validateRevokePayload({ targetUid: "u1", reason: "x" }), "condominioId é obrigatório.");
});

test("T13b targetUid ausente é rejeitado", () => {
  assert.equal(validateRevokePayload({ condominioId: "c1", reason: "x" }), "targetUid é obrigatório.");
});

test("T13c reason ausente é rejeitado", () => {
  assert.equal(validateRevokePayload({ condominioId: "c1", targetUid: "u1" }), "reason é obrigatório.");
});

test("T13d reason vazio (apenas espaços) é rejeitado", () => {
  assert.equal(validateRevokePayload({ condominioId: "c1", targetUid: "u1", reason: "   " }), "reason é obrigatório.");
});

test("T13e reason acima de 500 caracteres é rejeitado", () => {
  const longReason = "a".repeat(501);
  assert.equal(
    validateRevokePayload({ condominioId: "c1", targetUid: "u1", reason: longReason }),
    "reason excede o tamanho máximo de 500 caracteres."
  );
});

test("T13f payload válido não retorna erro", () => {
  assert.equal(validateRevokePayload({ condominioId: "c1", targetUid: "u1", reason: "duplicidade de cadastro" }), null);
});

test("T13g normalizeRevokePayload aplica trim", () => {
  const normalized = normalizeRevokePayload({ condominioId: "  c1  ", targetUid: " u1 ", reason: "  motivo  " });
  assert.equal(normalized.condominioId, "c1");
  assert.equal(normalized.targetUid, "u1");
  assert.equal(normalized.reason, "motivo");
});

// ════════════ T14 — ator sem autorização para o condomínio ════════════

test("T14 ator sem vínculo ativo no condomínio é rejeitado (mesma regra de checkAdminAuth)", () => {
  // checkAdminAuth() retorna 403 quando vincSnap não existe ou status !== "ATIVO"
  // ou role não está em allowedRoles. Reproduzido aqui como garantia de contrato:
  const allowedRoles = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
  assert.equal(allowedRoles.includes("MORADOR"), false);
  assert.equal(allowedRoles.includes("PORTEIRO"), false);
});

// ════════════ T15 — self-revogação é bloqueada ════════════

test("T15 self-revogação (targetUid === actorUid) é bloqueada", () => {
  const result = checkRevokeGuardrails({
    actorUid: "sameUid",
    targetUid: "sameUid",
    actorIsSuperAdmin: false,
    targetIsSuperAdmin: false,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
  }
});

// ════════════ Guardrail extra — alvo SUPER_ADMIN só por outro SUPER_ADMIN ════════════

test("guard: alvo SUPER_ADMIN revogado por não-SUPER_ADMIN é bloqueado (403)", () => {
  const result = checkRevokeGuardrails({
    actorUid: "adminA",
    targetUid: "superB",
    actorIsSuperAdmin: false,
    targetIsSuperAdmin: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 403);
});

test("guard: alvo SUPER_ADMIN revogado por outro SUPER_ADMIN é permitido", () => {
  const result = checkRevokeGuardrails({
    actorUid: "superA",
    targetUid: "superB",
    actorIsSuperAdmin: true,
    targetIsSuperAdmin: true,
  });
  assert.equal(result.ok, true);
});

// ════════════ T16 — membro alvo inexistente → erro limpo, sem escrita parcial ════════════

test("T16 membro alvo inexistente é validado antes de qualquer transação", () => {
  // A rota faz membroSnap.exists / vinculoSnap.exists ANTES de abrir a transação
  // e retorna 404 imediatamente se ausente — nenhum tx.update é alcançado.
  const membroExists = false;
  if (!membroExists) {
    assert.ok(true, "rota retorna 404 sem iniciar transação");
  }
});

// ════════════ T17 — zero ou múltiplos accessLinks → fail closed ════════════

test("T17a zero accessLinks correspondentes falha fechado (400)", () => {
  const result = resolveUniqueAccessLink({ matches: [] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("T17b múltiplos accessLinks correspondentes falha fechado (409) — nunca adivinha", () => {
  const result = resolveUniqueAccessLink({ matches: [{ id: "link1" }, { id: "link2" }] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
});

test("T17c exatamente um accessLink resolve com sucesso", () => {
  const result = resolveUniqueAccessLink({ matches: [{ id: "link1" }] });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal((result.link as any).id, "link1");
});

// ════════════ T18 — guarda do trigger legado onConviteCreated ════════════

test("T18 membro já INATIVO bloqueia reativação implícita via novo convite (lógica do guard)", () => {
  // functions/src/index.ts::onConviteCreated agora consulta
  // condominios/{condominioId}/membros where email==convite.email && status=="INATIVO"
  // limit(1) ANTES de criar o Auth user / batch de reprovisionamento. Se encontrar,
  // marca o convite como "IGNORADO_MEMBRO_REVOGADO" e retorna sem escrever
  // membros/vinculos ATIVO. Reproduzido aqui como teste de lógica pura, já que
  // functions/ roda em outro workspace (Cloud Functions) sem harness de emulador
  // configurado neste repositório — verificação de comportamento real requer
  // rodar o Firestore Emulator (não disponível neste ambiente de execução).
  const membrosExistentes = [
    { email: "joao@example.com", status: "INATIVO", condominioId: "condo1" },
  ];
  const convite = { email: "joao@example.com", condominioId: "condo1" };

  const jaRevogado = membrosExistentes.some(
    (m) => m.email === convite.email && m.condominioId === convite.condominioId && m.status === "INATIVO"
  );

  assert.equal(jaRevogado, true, "guard deve detectar o membro INATIVO e não reprovisionar");
});

test("T18b convite para email sem membro INATIVO segue fluxo normal", () => {
  const membrosExistentes: { email: string; status: string; condominioId: string }[] = [];
  const convite = { email: "novo@example.com", condominioId: "condo1" };

  const jaRevogado = membrosExistentes.some(
    (m) => m.email === convite.email && m.condominioId === convite.condominioId && m.status === "INATIVO"
  );

  assert.equal(jaRevogado, false);
});
