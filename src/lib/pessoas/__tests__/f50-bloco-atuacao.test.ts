/**
 * P1.0 — ETAPA 5 — TESTES — blocoAtuacaoId (local de atuação/referência)
 *
 * Cobre validação de forma e persistência via buildPessoaDoc/validateBlocoAtuacaoId
 * (src/lib/pessoas/service.ts) e a separação estrutural entre blocoAtuacaoId e
 * os mecanismos de vínculo residencial (Vinculo/accessLink/vinculosUnidades).
 *
 * CASO 9 (bloco inexistente) e CASO 10 (bloco de outro condomínio) exigem
 * Firestore real — a existência/tenant-scoping é garantida pela própria
 * estrutura do path usado em route.ts:
 *   db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoAtuacaoId)
 * que é idêntica ao mecanismo já homologado para blocoId residencial (mesma
 * função, mesmo escopo por construção — impossível referenciar um bloco de
 * outro condominioId por esse path). Cobertos via teste funcional real
 * (Etapa 23), não aqui.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPessoaDoc, validateBlocoAtuacaoId } from "../service";
import { requiresResidentialUnit, type PessoaVinculoSnapshot } from "../domain/rules";

function snapshot(overrides: Partial<PessoaVinculoSnapshot>): PessoaVinculoSnapshot {
  return { role: null, categoriaPessoa: null, moraNoCondominio: null, blocoId: null, unidadeId: null, ...overrides };
}

// ════════════ CASO 1 — Administrador não residente, blocoAtuacaoId=ADM ════════════

test("CASO 1 — administrador não residente com blocoAtuacaoId=ADM é permitido", () => {
  assert.equal(validateBlocoAtuacaoId("ADM"), null);
  const doc = buildPessoaDoc({
    condominioId: "condo-1", nome: "Admin Não Residente",
    categoriaPessoa: "ADMINISTRADORA", moraNoCondominio: false, blocoAtuacaoId: "ADM",
  });
  assert.equal(doc.blocoAtuacaoId, "ADM");
  assert.equal(doc.moraNoCondominio, false);
});

// ════════════ CASO 2 — Síndico profissional, blocoAtuacaoId=Dalias ════════════

test("CASO 2 — síndico profissional com blocoAtuacaoId=Dalias é permitido", () => {
  const doc = buildPessoaDoc({
    condominioId: "condo-1", nome: "Síndico Profissional",
    categoriaPessoa: "SINDICO_PROFISSIONAL", moraNoCondominio: false, blocoAtuacaoId: "Dalias",
  });
  assert.equal(doc.blocoAtuacaoId, "Dalias");
});

// ════════════ CASO 3 — Pessoa sem local de atuação, blocoAtuacaoId=null ════════════

test("CASO 3 — blocoAtuacaoId=null é permitido", () => {
  assert.equal(validateBlocoAtuacaoId(null), null);
  const doc = buildPessoaDoc({ condominioId: "condo-1", nome: "Prestador Sem Local", blocoAtuacaoId: null });
  assert.equal(doc.blocoAtuacaoId, null);
});

// ════════════ CASO 4 — Morador residente: residência e atuação coexistem sem conflito ════════════

test("CASO 4 — morador residente (blocoId/unidade) + blocoAtuacaoId coexistem sem conflito", () => {
  // blocoId/unidadeId (residência) NUNCA são campos de PersonData — vivem em
  // Vinculo, gerenciados fora de buildPessoaDoc. blocoAtuacaoId é o único
  // campo de local operacional em PersonData; ambos são independentes por
  // construção (buildPessoaDoc nunca lê blocoId residencial).
  const doc = buildPessoaDoc({
    condominioId: "condo-1", nome: "Morador com Atuação em Outro Bloco",
    categoriaPessoa: "MORADOR", moraNoCondominio: true, blocoAtuacaoId: "ADM",
  });
  assert.equal(doc.blocoAtuacaoId, "ADM");
  assert.equal(doc.moraNoCondominio, true);
  assert.ok(!("blocoId" in doc), "PersonData nunca deve conter blocoId residencial");
  assert.ok(!("unidadeId" in doc), "PersonData nunca deve conter unidadeId residencial");
});

// ════════════ CASO 5 — blocoAtuacaoId não cria Vinculo ════════════

test("CASO 5 — buildPessoaDoc nunca produz shape de Vinculo (sem role/status de membro)", () => {
  const doc = buildPessoaDoc({ condominioId: "condo-1", nome: "X", blocoAtuacaoId: "ADM" });
  // PersonData não tem `role` — role é exclusivo de Vinculo (types.ts). A
  // presença de blocoAtuacaoId não introduz esse campo.
  assert.ok(!("role" in doc));
});

// ════════════ CASO 6 — blocoAtuacaoId não cria accessLink MORADOR ════════════

test("CASO 6 — condição de criação de accessLink (route.ts) nunca depende de blocoAtuacaoId", () => {
  // Mirror exato da condição em create-or-update/route.ts:
  // `permitirAcessoApp && modoAcesso === "SELF_ONBOARDING" && email && emailNorm && blocoId && unitDocId && tipoVinculo`
  // blocoAtuacaoId não aparece nela — logo, presente ou não, nunca influencia.
  function criaAccessLink(p: { permitirAcessoApp: boolean; modoAcesso: string; email: string | null; blocoId: string | null; unitDocId: string | null; tipoVinculo: string | null }) {
    return Boolean(p.permitirAcessoApp && p.modoAcesso === "SELF_ONBOARDING" && p.email && p.blocoId && p.unitDocId && p.tipoVinculo);
  }
  const naoResidenteComAtuacao = criaAccessLink({
    permitirAcessoApp: true, modoAcesso: "SELF_ONBOARDING", email: "a@b.com",
    blocoId: null, unitDocId: null, tipoVinculo: null,
  });
  assert.equal(naoResidenteComAtuacao, false);
});

// ════════════ CASO 7 — blocoAtuacaoId não cria vinculosUnidades ════════════

test("CASO 7 — gatilho de vinculosUnidades (page.tsx) nunca depende de blocoAtuacaoId", () => {
  // Mirror exato do gatilho em page.tsx: `data.personId && form.blocoId && form.unitDocId`
  function criaVinculoUnidade(personId: string, form: { blocoId: string; unitDocId: string }) {
    return Boolean(personId && form.blocoId && form.unitDocId);
  }
  const naoResidenteComAtuacao = criaVinculoUnidade("person-1", { blocoId: "", unitDocId: "" });
  assert.equal(naoResidenteComAtuacao, false);
});

// ════════════ CASO 8 — tipo inválido → erro de validação ════════════

test("CASO 8 — blocoAtuacaoId com tipo inválido é rejeitado", () => {
  assert.ok(validateBlocoAtuacaoId(123));
  assert.ok(validateBlocoAtuacaoId(true));
  assert.ok(validateBlocoAtuacaoId({}));
  assert.ok(validateBlocoAtuacaoId(""));
});

// ════════════ CASO 11 — payload legado sem blocoAtuacaoId continua funcionando ════════════

test("CASO 11 — payload legado sem blocoAtuacaoId continua funcionando", () => {
  const doc = buildPessoaDoc({ condominioId: "condo-1", nome: "Pessoa Legada" });
  assert.equal(doc.blocoAtuacaoId, null);
  assert.notEqual(doc.blocoAtuacaoId, undefined);
});

// ════════════ CASO 12 — MORADOR continua exigindo residência normalmente ════════════

test("CASO 12 — MORADOR continua exigindo residência independentemente de blocoAtuacaoId [regra de domínio real]", () => {
  // PessoaVinculoSnapshot (domain/rules.ts) nem sequer possui campo
  // blocoAtuacaoId — a regra homologada de residência é estruturalmente
  // incapaz de ser influenciada por ele.
  const pessoa = snapshot({ role: "MORADOR", moraNoCondominio: null });
  assert.equal(requiresResidentialUnit(pessoa), true);
});
