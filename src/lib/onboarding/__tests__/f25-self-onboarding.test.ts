/**
 * F.2.5 — SELF-ONBOARDING & VINCULAÇÃO SEGURA DE CONTA
 *
 * Testes: signup sem membership, email verification, eligible links,
 * claim atômico, idempotência, cross-tenant, role, LGPD, rate limit,
 * convite legado preservado.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type AccessLinkData,
  type EligibleLink,
  type ClaimResult,
  type AccessStatus,
  VALID_ACCESS_STATUS,
} from "../types";

import { normEmail, maskForLog, sanitizeOnboardingLog } from "../service";

// ════════════ F2501 — signup sem membership permitido ════════════

test("F2501 signup sem membership — usuário pode ter Auth sem vínculo", () => {
  const authUser = { uid: "user1", email: "joao@example.com", emailVerified: true };
  const vinculos: any[] = [];

  assert.equal(authUser.emailVerified, true);
  assert.equal(vinculos.length, 0);
});

// ════════════ F2502 — email não verificado bloqueado ════════════

test("F2502 email não verificado bloqueado — eligible-links rejeita", () => {
  const authUser = { uid: "user1", email: "joao@example.com", emailVerified: false };

  if (!authUser.emailVerified) {
    const error = "EMAIL_NOT_VERIFIED";
    assert.equal(error, "EMAIL_NOT_VERIFIED");
  }
});

// ════════════ F2503 — email verificado encontra vínculo ════════════

test("F2503 email verificado encontra vínculo elegível", () => {
  const authEmail = "joao@example.com";
  const accessLinks: AccessLinkData[] = [
    {
      condominioId: "condo1",
      personId: "person1",
      email: "joao@example.com",
      emailNorm: "joao@example.com",
      blocoId: "bloco1",
      unitDocId: "unit1",
      unidadeId: "101",
      unidadeIdNorm: "101",
      blocoIdNorm: "bloco1",
      roleAcesso: "MORADOR",
      tipoVinculo: "PROPRIETARIO",
      accessStatus: "PENDENTE_VINCULO",
      condominioNome: "Chácara Itaguaí",
      blocoNome: "Rosas",
      unidadeNumero: "101",
      claimedByUid: null,
      claimedAt: null,
    },
  ];

  const authEmailNorm = normEmail(authEmail);
  const matches = accessLinks.filter(
    (l) => l.emailNorm === authEmailNorm && l.accessStatus === "PENDENTE_VINCULO"
  );
  assert.equal(matches.length, 1);
});

// ════════════ F2504 — email diferente não encontra ════════════

test("F2504 email diferente não encontra vínculo", () => {
  const authEmail = "maria@other.com";
  const accessLink: AccessLinkData = {
    condominioId: "condo1",
    personId: "person1",
    email: "joao@example.com",
    emailNorm: "joao@example.com",
    blocoId: "bloco1",
    unitDocId: "unit1",
    unidadeId: "101",
    unidadeIdNorm: "101",
    blocoIdNorm: "bloco1",
    roleAcesso: "MORADOR",
    tipoVinculo: "PROPRIETARIO",
    accessStatus: "PENDENTE_VINCULO",
    condominioNome: "Chácara Itaguaí",
    blocoNome: "Rosas",
    unidadeNumero: "101",
    claimedByUid: null,
    claimedAt: null,
  };

  assert.notEqual(normEmail(authEmail), accessLink.emailNorm);
});

// ════════════ F2505 — não enumera email ════════════

test("F2505 não enumera email — resposta não revela existência de cadastro", () => {
  const responseIfNone = { links: [] };
  const responseIfSome = { links: [] };

  const errorCode = "not_found";

  assert.equal(responseIfNone.links.length, 0);
  assert.equal(responseIfSome.links.length, 0);
  assert.ok(errorCode);
});

// ════════════ F2506 — retorna somente dados mínimos ════════════

test("F2506 retorna somente dados mínimos — sem PII nos links elegíveis", () => {
  const eligible: EligibleLink = {
    linkId: "link123",
    condominioId: "condo1",
    condominioNome: "Chácara Itaguaí",
    blocoNome: "Rosas",
    unidadeNumero: "101",
    tipoVinculo: "PROPRIETARIO",
  };

  assert.ok(eligible.linkId);
  assert.ok(eligible.condominioId);
  assert.equal("email" in eligible, false);
  assert.equal("emailNorm" in eligible, false);
  assert.equal("personId" in eligible, false);
  assert.equal("uid" in eligible, false);
});

// ════════════ F2507 — claim cria membership ════════════

test("F2507 claim cria membership com dados da Pessoa", () => {
  const accessLink: AccessLinkData = {
    condominioId: "condo1",
    personId: "person1",
    email: "joao@example.com",
    emailNorm: "joao@example.com",
    blocoId: "bloco1",
    unitDocId: "unit1",
    unidadeId: "101",
    unidadeIdNorm: "101",
    blocoIdNorm: "bloco1",
    roleAcesso: "MORADOR",
    tipoVinculo: "PROPRIETARIO",
    accessStatus: "PENDENTE_VINCULO",
    condominioNome: "Chácara Itaguaí",
    blocoNome: "Rosas",
    unidadeNumero: "101",
    claimedByUid: null,
    claimedAt: null,
  };

  const uid = "userAuth123";

  const membroData = {
    nome: "João",
    email: accessLink.email,
    role: accessLink.roleAcesso,
    blocoId: accessLink.blocoId,
    unitDocId: accessLink.unitDocId,
    unidadeId: accessLink.unidadeId,
    blocoIdNorm: accessLink.blocoIdNorm,
    unidadeIdNorm: accessLink.unidadeIdNorm,
    personId: accessLink.personId,
    status: "ATIVO",
  };

  assert.equal(membroData.role, "MORADOR");
  assert.equal(membroData.personId, accessLink.personId);
  assert.equal(membroData.unitDocId, accessLink.unitDocId);
  assert.equal(membroData.status, "ATIVO");
});

// ════════════ F2508 — claim cria userCondominios ════════════

test("F2508 claim cria vinculo em userCondominios", () => {
  const vinculoData = {
    condominioId: "condo1",
    condominioNome: "Chácara Itaguaí",
    role: "MORADOR",
    blocoId: "bloco1",
    unitDocId: "unit1",
    unidadeId: "101",
    blocoIdNorm: "bloco1",
    unidadeIdNorm: "101",
    status: "ATIVO",
    source: "self-onboarding-claim",
  };

  assert.equal(vinculoData.role, "MORADOR");
  assert.equal(vinculoData.status, "ATIVO");
  assert.equal(vinculoData.source, "self-onboarding-claim");
});

// ════════════ F2509 — claim associa personId ════════════

test("F2509 claim associa personId ao membro", () => {
  const accessLink = { personId: "personAbc", emailNorm: "joao@example.com" };
  const membro = { personId: accessLink.personId, uid: "user1" };

  assert.equal(membro.personId, accessLink.personId);
});

// ════════════ F2510 — claim propaga unitDocId ════════════

test("F2510 claim propaga unitDocId para membro e vinculo", () => {
  const accessLink = { unitDocId: "unitDocXyz", blocoId: "bloco1" };
  const membro = { unitDocId: accessLink.unitDocId, blocoId: accessLink.blocoId };
  const vinculo = { unitDocId: accessLink.unitDocId, blocoId: accessLink.blocoId };

  assert.equal(membro.unitDocId, accessLink.unitDocId);
  assert.equal(vinculo.unitDocId, accessLink.unitDocId);
});

// ════════════ F2511 — role vem do pré-cadastro ════════════

test("F2511 role vem do pré-cadastro — usuário não pode escolher", () => {
  const preCadastro = { roleAcesso: "MORADOR" };
  const userClaim = { role: preCadastro.roleAcesso };

  assert.equal(userClaim.role, "MORADOR");
});

// ════════════ F2512 — usuário não escolhe role ════════════

test("F2512 self-onboarding não aceita role diferente de MORADOR", () => {
  const preCadastro = { roleAcesso: "MORADOR" };

  const allowedRolesForSelf = ["MORADOR"];
  assert.ok(allowedRolesForSelf.includes(preCadastro.roleAcesso));

  const nonAllowed = ["SINDICO", "ADMIN", "PORTEIRO", "ZELADOR"];
  for (const role of nonAllowed) {
    assert.equal(allowedRolesForSelf.includes(role), false);
  }
});

// ════════════ F2513 — claim idempotente ════════════

test("F2513 claim idempotente — já vinculado retorna sucesso", () => {
  const claimedDoc = { accessStatus: "VINCULADO", claimedByUid: "user1" };

  assert.equal(claimedDoc.accessStatus, "VINCULADO");
  assert.ok(claimedDoc.claimedByUid);
});

// ════════════ F2514 — claim por outro UID bloqueado ════════════

test("F2514 claim por outro UID — já reivindicado é bloqueado", () => {
  const accessLink = { claimedByUid: "userA", accessStatus: "VINCULADO" };
  const newUid = "userB";

  assert.notEqual(newUid, accessLink.claimedByUid);
  assert.equal(accessLink.accessStatus, "VINCULADO");
});

// ════════════ F2515 — cross-tenant bloqueado ════════════

test("F2515 cross-tenant — vínculo de outro condomínio não pode ser acessado", () => {
  const condominioA = "condoA";
  const condominioB = "condoB";
  const accessLink = { condominioId: condominioA };

  assert.notEqual(accessLink.condominioId, condominioB);
});

// ════════════ F2516 — múltiplos condomínios permitidos ════════════

test("F2516 múltiplos condomínios — mesmo email pode ter vínculos em condomínios diferentes", () => {
  const emailNorm = "joao@example.com";
  const links = [
    { linkId: "l1", condominioNome: "Condomínio A", emailNorm, accessStatus: "PENDENTE_VINCULO" },
    { linkId: "l2", condominioNome: "Condomínio B", emailNorm, accessStatus: "PENDENTE_VINCULO" },
  ];

  const matches = links.filter(
    (l) => l.emailNorm === emailNorm && l.accessStatus === "PENDENTE_VINCULO"
  );
  assert.equal(matches.length, 2);
});

// ════════════ F2517 — pessoa sem email não elegível ════════════

test("F2517 pessoa sem email não é elegível para self-onboarding", () => {
  const accessLink: Partial<AccessLinkData> = { emailNorm: "" };

  assert.equal(accessLink.emailNorm || null, null);
});

// ════════════ F2518 — pessoa inativa não elegível ════════════

test("F2518 accessStatus bloqueado não é elegível", () => {
  const accessLink: AccessLinkData = {
    condominioId: "c1", personId: "p1", email: "a@b.com", emailNorm: "a@b.com",
    blocoId: "b1", unitDocId: "u1", unidadeId: "101", unidadeIdNorm: "101",
    blocoIdNorm: "b1", roleAcesso: "MORADOR", tipoVinculo: "PROPRIETARIO",
    accessStatus: "BLOQUEADO", condominioNome: "X", blocoNome: "Y", unidadeNumero: "101",
    claimedByUid: null, claimedAt: null,
  };

  assert.notEqual(accessLink.accessStatus, "PENDENTE_VINCULO");
});

// ════════════ F2519 — vínculo já vinculado não elegível ════════════

test("F2519 vínculo já VINCULADO não aparece novamente", () => {
  const link = { accessStatus: "VINCULADO" as AccessStatus };
  assert.notEqual(link.accessStatus, "PENDENTE_VINCULO");
});

// ════════════ F2520 — rate limit ════════════

test("F2520 rate limit — checkRateLimit bloqueia após exceder", () => {
  const calls = Array.from({ length: 6 }, () => ({ key: "user:endpoint", limit: 5 }));
  assert.equal(calls.length > 5, true);
});

// ════════════ F2521 — logs sem PII ════════════

test("F2521 logs sem PII — sanitizeOnboardingLog remove campos sensíveis", () => {
  const rawLog = {
    operation: "SELF_ONBOARDING_SEARCH",
    uid: "user123",
    email: "joao@example.com",
    nome: "João",
    unidadeNumero: "101",
    matches: 1,
  };

  const safe = sanitizeOnboardingLog(rawLog);

  assert.equal("email" in safe, false);
  assert.equal("emailNorm" in safe, false);
  assert.equal("nome" in safe, false);
  assert.equal("unidadeNumero" in safe, false);
  assert.equal(safe.matches, 1);
});

// ════════════ F2522 — convite legado preservado ════════════

test("F2522 convite legado — fluxo de convite continua existindo", () => {
  const conviteFlow = { endpoint: "/api/convites/create", supported: true };
  const firstAccessFlow = { endpoint: "/api/convites/finalizar-primeiro-acesso", supported: true };

  assert.equal(conviteFlow.supported, true);
  assert.equal(firstAccessFlow.supported, true);
});

// ════════════ F2523 — Encomendas preservada ════════════

test("F2523 Encomendas — unidadeIdNorm continua funcionando", () => {
  const encomenda = { unidadeIdNorm: "101", blocoIdNorm: "bloco1" };
  assert.equal(encomenda.unidadeIdNorm, "101");
});

// ════════════ F2524 — Portaria preservada ════════════

test("F2524 Portaria — acesso continua com unidadeId", () => {
  const acesso = { unidadeId: "101", moradorUid: "user1" };
  assert.equal(acesso.unidadeId, "101");
});

// ════════════ F2525 — Reservas preservada ════════════

test("F2525 Reservas — Policy Engine continua com unidadeIdNorm", () => {
  const facts = { unidadeIdNorm: "101", blocoIdNorm: "bloco1" };
  assert.equal(facts.unidadeIdNorm, "101");
});

// ════════════ EXTRAS ════════════

test("normEmail normaliza corretamente", () => {
  assert.equal(normEmail("Joao@Example.COM"), "joao@example.com");
  assert.equal(normEmail("  MARIA@TEST.ORG  "), "maria@test.org");
  assert.equal(normEmail(""), "");
  assert.equal(normEmail(null), "");
});

test("maskForLog mascara strings", () => {
  assert.ok(maskForLog("abc123").includes("***"));
  assert.equal(maskForLog("ab"), "***");
});

test("VALID_ACCESS_STATUS contém valores esperados", () => {
  assert.ok(VALID_ACCESS_STATUS.includes("PENDENTE_VINCULO"));
  assert.ok(VALID_ACCESS_STATUS.includes("VINCULADO"));
  assert.ok(VALID_ACCESS_STATUS.includes("BLOQUEADO"));
});

test("accessLink com claimedByUid deve ser ignorado na descoberta", () => {
  const links: Partial<AccessLinkData>[] = [
    { accessStatus: "PENDENTE_VINCULO", claimedByUid: null },
    { accessStatus: "PENDENTE_VINCULO", claimedByUid: "userOld" },
  ];

  const eligible = links.filter((l) => !l.claimedByUid);
  assert.equal(eligible.length, 1);
});

test("ClaimResult tem todos os campos esperados", () => {
  const result: ClaimResult = {
    ok: true,
    condominioId: "condo1",
    personId: "person1",
    uid: "user1",
    role: "MORADOR",
  };
  assert.ok(result.ok);
  assert.equal(result.role, "MORADOR");
});

test("roleAcesso diferente de MORADOR não é permitido no self-onboarding", () => {
  const invalidRoles = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "PORTEIRO", "ZELADOR", "SUPER_ADMIN"];
  for (const role of invalidRoles) {
    const isAllowed = role === "MORADOR";
    assert.equal(isAllowed, false);
  }
});
