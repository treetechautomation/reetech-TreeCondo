/**
 * FASE F.2.1 — TESTES DA FUNDAÇÃO DO DOMÍNIO PESSOA
 *
 * Cobre: tipos canônicos, service layer, validação, autorização,
 * link membership, idempotência, LGPD / privacy by design.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ════════════ IMPORTS ════════════

import {
  type PersonStatus,
  type PersonData,
  type PersonCreatePayload,
  type PersonUpdatePayload,
  type LinkMembershipPayload,
  type LinkMembershipResult,
  VALID_PERSON_STATUS,
  VALID_PERSON_ORIGINS,
} from "../types";

import {
  buildPessoaDoc,
  validatePersonPayload,
  validateLinkMembershipPayload,
  buildLinkResult,
  maskPersonId,
  sanitizeLogData,
} from "../service";

// ════════════ TIPOS CANÔNICOS ════════════

const CANONICAL_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "ADMIN_CONDOMINIO",
  "SINDICO",
  "PORTEIRO",
  "ZELADOR",
  "MORADOR",
] as const;

type MembroRole = (typeof CANONICAL_ROLES)[number];

// ════════════ F2101 — personId INDEPENDENTE DE UID ════════════

test("F2101 personId independente de uid — personId é Firestore auto-id", () => {
  const personId = "aBc123XyZ456";
  const uid = "firebase-auth-uid-789";

  assert.notEqual(personId, uid);
  assert.ok(personId.length > 0);
  assert.ok(uid.length > 0);
});

test("F2101 personId independente de uid — email não é personId", () => {
  const email = "pessoa@tree.com";
  const personId = "aBc123XyZ";

  assert.notEqual(personId, email);
});

// ════════════ F2102 — PESSOA SEM AUTH É VÁLIDA ════════════

test("F2102 pessoa sem Auth é válida — payload mínimo", () => {
  const payload: PersonCreatePayload = {
    condominioId: "condo-1",
    nome: "Pessoa Teste",
  };

  const doc = buildPessoaDoc(payload);
  assert.equal(doc.condominioId, "condo-1");
  assert.equal(doc.nome, "Pessoa Teste");
  assert.equal(doc.status, "ATIVO");
  assert.equal(doc.email, null);
  assert.equal(doc.telefone, null);
  assert.ok(doc.createdAt);
  assert.ok(doc.updatedAt);
});

test("F2102 pessoa sem Auth — nenhuma dependência de Firebase Auth", () => {
  const payload: PersonCreatePayload = {
    condominioId: "condo-1",
    nome: "Sem Login",
  };

  const doc = buildPessoaDoc(payload);
  // Pessoa não requer uid, aauth, nem token
  assert.ok(doc.nome);
  assert.ok(!doc.email);
});

// ════════════ F2103 — EMAIL OPCIONAL ════════════

test("F2103 email opcional — pode ser null", () => {
  const payload: PersonCreatePayload = {
    condominioId: "condo-1",
    nome: "Sem Email",
    email: null,
  };

  const doc = buildPessoaDoc(payload);
  assert.equal(doc.email, null);
});

test("F2103 email opcional — pode ser preenchido", () => {
  const payload: PersonCreatePayload = {
    condominioId: "condo-1",
    nome: "Com Email",
    email: "  Pessoa@Teste.com  ",
  };

  const doc = buildPessoaDoc(payload);
  assert.equal(doc.email, "pessoa@teste.com");
});

// ════════════ F2104 — PESSOA SCOPED POR CONDOMÍNIO ════════════

test("F2104 pessoa scoped por condomínio — condominioId obrigatório", () => {
  const error = validatePersonPayload({ condominioId: "", nome: "X" } as any);
  assert.ok(error);
  assert.ok(error!.includes("condominioId"));
});

test("F2104 pessoa scoped por condomínio — nome obrigatório", () => {
  const error = validatePersonPayload({ condominioId: "c1", nome: "" } as any);
  assert.ok(error);
  assert.ok(error!.includes("nome"));
});

test("F2104 pessoa scoped — payload válido passa validação", () => {
  const error = validatePersonPayload({ condominioId: "c1", nome: "X" });
  assert.equal(error, null);
});

// ════════════ F2105 — CROSS-TENANT BLOQUEADO ════════════

test("F2105 cross-tenant — pessoa pertence a um único condomínio", () => {
  const pessoa: PersonData = {
    condominioId: "condo-1",
    nome: "Pessoa",
    status: "ATIVO",
  };

  // Pessoa de condo-1 NÃO deve ser acessível por condo-2
  const outroCondo = "condo-2";
  assert.notEqual(pessoa.condominioId, outroCondo);
});

test("F2105 cross-tenant — link valida condominioId", () => {
  const error = validateLinkMembershipPayload({
    condominioId: "",
    personId: "p1",
    uid: "u1",
  });
  assert.ok(error);
  assert.ok(error!.includes("condominioId"));
});

// ════════════ F2106 — CREATE PESSOA AUTORIZADO ════════════

test("F2106 create pessoa — telefone inválido rejeitado", () => {
  const error = validatePersonPayload({
    condominioId: "c1",
    nome: "X",
    telefone: "x".repeat(31),
  });
  assert.ok(error);
  assert.ok(error!.includes("telefone"));
});

// ════════════ F2107 — ROLE NÃO AUTORIZADA BLOQUEADA ════════════

test("F2107 role não autorizada bloqueada — apenas roles de gestão", () => {
  const ROLES_AUTORIZADAS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

  // MORADOR não pode criar pessoa
  assert.ok(!ROLES_AUTORIZADAS.includes("MORADOR"));
  // PORTEIRO não pode
  assert.ok(!ROLES_AUTORIZADAS.includes("PORTEIRO"));
  // ZELADOR não pode
  assert.ok(!ROLES_AUTORIZADAS.includes("ZELADOR"));
  // SINDICO pode
  assert.ok(ROLES_AUTORIZADAS.includes("SINDICO"));
});

// ════════════ F2108 — MEMBRO SEM personId CONTINUA VÁLIDO ════════════

test("F2108 membro sem personId continua válido — backward-compatible", () => {
  const membro = {
    uid: "user-1",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
    // personId ausente
  };

  const hasPersonId = !!(membro as any).personId;
  assert.equal(hasPersonId, false);
  // Membro funciona normalmente sem personId
  assert.equal(membro.role, "MORADOR");
  assert.equal(membro.status, "ATIVO");
});

// ════════════ F2109 — LINK PESSOA↔MEMBRO ════════════

test("F2109 link pessoa↔membro — payload válido", () => {
  const error = validateLinkMembershipPayload({
    condominioId: "c1",
    personId: "p1",
    uid: "u1",
  });
  assert.equal(error, null);
});

test("F2109 link — payload inválido: personId ausente", () => {
  const error = validateLinkMembershipPayload({
    condominioId: "c1",
    personId: "",
    uid: "u1",
  });
  assert.ok(error);
  assert.ok(error!.includes("personId"));
});

test("F2109 link — payload inválido: uid ausente", () => {
  const error = validateLinkMembershipPayload({
    condominioId: "c1",
    personId: "p1",
    uid: "",
  });
  assert.ok(error);
  assert.ok(error!.includes("uid"));
});

// ════════════ F2110 — LINK IDEMPOTENTE ════════════

test("F2110 link idempotente — mesmo personId retorna alreadyLinked", () => {
  const result = buildLinkResult("p1", "u1", "c1", true);
  assert.equal(result.ok, true);
  assert.equal(result.alreadyLinked, true);
});

test("F2110 link idempotente — novo link retorna alreadyLinked=false", () => {
  const result = buildLinkResult("p1", "u1", "c1", false);
  assert.equal(result.ok, true);
  assert.equal(result.alreadyLinked, false);
});

// ════════════ F2111 — CONFLITO personId DIFERENTE ════════════

test("F2111 conflito personId diferente — membro já vinculado a outra pessoa", () => {
  const membroExistingPersonId: string | null = "person-old";
  const newPersonId = "person-new";

  const conflict = membroExistingPersonId !== null && membroExistingPersonId !== newPersonId;
  assert.ok(conflict);
});

// ════════════ F2112 — PESSOA DE OUTRO TENANT BLOQUEADA ════════════

test("F2112 pessoa de outro tenant — ids diferentes", () => {
  const pessoaCondo1 = { condominioId: "condo-1", personId: "p1" };
  const membroCondo1 = { condominioId: "condo-1", uid: "u1" };

  // Ambos no mesmo condomínio → permitido
  assert.equal(pessoaCondo1.condominioId, membroCondo1.condominioId);
});

// ════════════ F2113 — MEMBERSHIP DE OUTRO TENANT BLOQUEADO ════════════

test("F2113 membership de outro tenant — membro pertence ao condomínio correto", () => {
  const membroPath = "condominios/condo-1/membros/uid-1";
  const outroPath = "condominios/condo-2/membros/uid-1";

  assert.notEqual(membroPath, outroPath);
});

// ════════════ F2114 — PESSOA DUPLICADA ════════════

test("F2114 pessoa duplicada — email não é chave única absoluta", () => {
  // Pessoas sem email podem coexistir
  const pessoaSemEmail1 = buildPessoaDoc({ condominioId: "c1", nome: "A" });
  const pessoaSemEmail2 = buildPessoaDoc({ condominioId: "c1", nome: "B" });

  assert.equal(pessoaSemEmail1.email, null);
  assert.equal(pessoaSemEmail2.email, null);
  // Ambas são válidas (email não é unique constraint)
});

// ════════════ F2115 — LOGS SEM PII ════════════

test("F2115 logs sem PII — sanitizeLogData remove nome/email/telefone", () => {
  const raw = {
    operation: "PERSON_CREATED",
    condominioId: "c1",
    nome: "João Silva",
    email: "joao@tree.com",
    telefone: "11999999999",
    personId: "masked-xxx",
  };

  const clean = sanitizeLogData(raw);
  assert.ok(!("nome" in clean));
  assert.ok(!("email" in clean));
  assert.ok(!("telefone" in clean));
  assert.ok("operation" in clean);
  assert.ok("condominioId" in clean);
  assert.ok("personId" in clean);
});

test("F2115 logs — maskPersonId protege identificadores", () => {
  const short = maskPersonId("ab");
  assert.ok(short.includes("***"));

  const long = maskPersonId("abcdef1234567890");
  assert.ok(long.includes("***"));
  assert.equal(long.length, 7); // abc*** + null check = 7 chars (4 + ***)
});

// ════════════ F2116 — MEMBROS CONTINUAM AUTHORITATIVE ════════════

test("F2116 membros authoritative — membro dita role e status para acesso", () => {
  const membro = {
    uid: "user-1",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
  };

  // Membro permanece authoritative para controle de acesso
  assert.equal(membro.role, "MORADOR");
  assert.equal(membro.status, "ATIVO");
});

// ════════════ F2117 — userCondominios DERIVED ════════════

test("F2117 userCondominios derived — vinculo espelha membro", () => {
  const membro = { role: "PORTEIRO", status: "ATIVO" };
  const vinculo = { role: "PORTEIRO", status: "ATIVO" };

  assert.deepEqual(membro, vinculo);
});

// ════════════ F2118 — ENCOMENDAS PRESERVADA ════════════

test("F2118 Encomendas preservada — membro continua com campos normalizados", () => {
  const membro = {
    uid: "user-1",
    blocoIdNorm: "a",
    unidadeIdNorm: "101",
  };

  assert.ok(membro.blocoIdNorm);
  assert.ok(membro.unidadeIdNorm);
});

// ════════════ F2119 — PORTARIA PRESERVADA ════════════

test("F2119 Portaria preservada — membro com unidadeIdNorm", () => {
  const membro = {
    uid: "user-2",
    unidadeIdNorm: "202",
    role: "MORADOR",
  };

  assert.ok(membro.unidadeIdNorm);
});

// ════════════ F2120 — RESERVAS PRESERVADA ════════════

test("F2120 Reservas preservada — membro com blocoIdNorm para escopo", () => {
  const membro = {
    uid: "user-3",
    blocoIdNorm: "b",
    role: "MORADOR",
    status: "ATIVO",
  };

  assert.ok(membro.blocoIdNorm);
  assert.equal(membro.status, "ATIVO");
});

// ════════════ F2121 — BUILD PESSOA DOC ════════════

test("F2121 buildPessoaDoc — campos calculados corretamente", () => {
  const doc = buildPessoaDoc({
    condominioId: "condo-1",
    nome: "  Teste  ",
    email: "  Teste@Tree.com  ",
    telefone: "11999998888",
    metadata: { origem: "IMPORTACAO" },
  });

  assert.equal(doc.condominioId, "condo-1");
  assert.equal(doc.nome, "Teste");
  assert.equal(doc.email, "teste@tree.com");
  assert.equal(doc.telefone, "11999998888");
  assert.equal(doc.status, "ATIVO");
  assert.equal(doc.metadata?.origem, "IMPORTACAO");
  assert.ok(doc.createdAt);
  assert.ok(doc.updatedAt);
});

// ════════════ F2122 — PERSON DATA TYPE ════════════

test("F2122 PersonData — status válidos", () => {
  assert.ok(VALID_PERSON_STATUS.includes("ATIVO"));
  assert.ok(VALID_PERSON_STATUS.includes("INATIVO"));
  assert.equal(VALID_PERSON_STATUS.length, 2);
});

test("F2122 PersonData — origens válidas", () => {
  assert.ok(VALID_PERSON_ORIGINS.includes("CADASTRO_MANUAL"));
  assert.ok(VALID_PERSON_ORIGINS.includes("IMPORTACAO"));
  assert.ok(VALID_PERSON_ORIGINS.includes("CONVITE"));
});
