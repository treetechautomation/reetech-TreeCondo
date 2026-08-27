/**
 * P1.0 — ETAPA 3 — TESTES DE PERSISTÊNCIA — categoriaPessoa / moraNoCondominio
 *
 * Cobre validação e persistência dos novos campos opcionais em PersonData
 * via buildPessoaDoc/validateCategoriaPessoa/validateMoraNoCondominio,
 * usadas por POST /api/pessoas/create-or-update.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPessoaDoc,
  validateCategoriaPessoa,
  validateMoraNoCondominio,
} from "../service";
import { VALID_CATEGORIAS_PESSOA } from "../types";

// ════════════ 1. PAYLOAD LEGADO — comportamento anterior preservado ════════════

test("payload legado sem categoriaPessoa/moraNoCondominio — comportamento anterior preservado", () => {
  const doc = buildPessoaDoc({ condominioId: "condo-1", nome: "Pessoa Legada" });
  assert.equal(doc.condominioId, "condo-1");
  assert.equal(doc.nome, "Pessoa Legada");
  assert.equal(doc.status, "ATIVO");
  assert.equal(doc.categoriaPessoa, null);
  assert.equal(doc.moraNoCondominio, null);
  assert.notEqual(doc.categoriaPessoa, undefined);
  assert.notEqual(doc.moraNoCondominio, undefined);
});

// ════════════ 2. CATEGORIA VÁLIDA — aceita ════════════

test("categoriaPessoa válida (ADMINISTRADORA) — aceita", () => {
  assert.equal(validateCategoriaPessoa("ADMINISTRADORA"), null);
});

test("todos os valores homologados de VALID_CATEGORIAS_PESSOA são aceitos", () => {
  for (const categoria of VALID_CATEGORIAS_PESSOA) {
    assert.equal(validateCategoriaPessoa(categoria), null);
  }
});

// ════════════ 3. CATEGORIA INVÁLIDA — 400 ════════════

test("categoriaPessoa inválida (QUALQUER_COISA) — erro de validação", () => {
  const error = validateCategoriaPessoa("QUALQUER_COISA");
  assert.ok(error);
  assert.ok(error!.includes("categoriaPessoa"));
});

// ════════════ 4. BOOLEAN VÁLIDO — aceita ════════════

test("moraNoCondominio=false — aceita", () => {
  assert.equal(validateMoraNoCondominio(false), null);
});

test("moraNoCondominio=true — aceita", () => {
  assert.equal(validateMoraNoCondominio(true), null);
});

test("moraNoCondominio ausente/null — aceita (opcional/retrocompatível)", () => {
  assert.equal(validateMoraNoCondominio(undefined), null);
  assert.equal(validateMoraNoCondominio(null), null);
});

// ════════════ 5. TIPO INVÁLIDO — 400, sem coerção silenciosa ════════════

test("moraNoCondominio='false' (string) — erro, sem coerção silenciosa", () => {
  const error = validateMoraNoCondominio("false");
  assert.ok(error);
});

test("moraNoCondominio=1 (number) — erro, sem coerção silenciosa", () => {
  const error = validateMoraNoCondominio(1);
  assert.ok(error);
});

test("moraNoCondominio='sim' — erro, sem coerção silenciosa", () => {
  const error = validateMoraNoCondominio("sim");
  assert.ok(error);
});

// ════════════ 6. PERSON_ONLY — persiste os dois novos campos ════════════

test("PERSON_ONLY — persiste categoriaPessoa e moraNoCondominio no documento", () => {
  const doc = buildPessoaDoc({
    condominioId: "condo-1",
    nome: "Sem Acesso ao App",
    categoriaPessoa: "ADMINISTRADORA",
    moraNoCondominio: false,
  });
  assert.equal(doc.categoriaPessoa, "ADMINISTRADORA");
  assert.equal(doc.moraNoCondominio, false);
});

// ════════════ 7. MORADOR LEGADO — sem campos novos, continua funcionando ════════════

test("morador legado — sem categoriaPessoa/moraNoCondominio, doc continua válido", () => {
  const doc = buildPessoaDoc({ condominioId: "condo-1", nome: "Morador Legado" });
  assert.equal(doc.condominioId, "condo-1");
  assert.equal(doc.nome, "Morador Legado");
  assert.equal(doc.categoriaPessoa, null);
  assert.equal(doc.moraNoCondominio, null);
});

// ════════════ 8. NÃO RESIDENTE — persistência correta ════════════

test("não residente — categoriaPessoa=SINDICO_PROFISSIONAL, moraNoCondominio=false persiste corretamente", () => {
  const doc = buildPessoaDoc({
    condominioId: "condo-1",
    nome: "Síndico Profissional",
    categoriaPessoa: "SINDICO_PROFISSIONAL",
    moraNoCondominio: false,
  });
  assert.equal(doc.categoriaPessoa, "SINDICO_PROFISSIONAL");
  assert.equal(doc.moraNoCondominio, false);
});

// ════════════ NUNCA UNDEFINED NO DOCUMENTO ════════════

test("nunca envia undefined para os dois campos — sempre null quando ausente", () => {
  const doc = buildPessoaDoc({ condominioId: "condo-1", nome: "X" });
  assert.ok("categoriaPessoa" in doc);
  assert.ok("moraNoCondominio" in doc);
  assert.notEqual(doc.categoriaPessoa, undefined);
  assert.notEqual(doc.moraNoCondominio, undefined);
});
