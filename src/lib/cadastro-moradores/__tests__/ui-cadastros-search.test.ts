/**
 * UI.CADASTROS.SEARCH — TESTES DA BUSCA EM "Pessoas cadastradas"
 *
 * Cobre a função pura filterPessoasPorBusca / matchesSearch usada pela tela
 * src/app/cadastros/pessoas/page.tsx para combinar busca livre com o filtro
 * de papel (chips: Todos / Moradores / Síndicos / Administradores /
 * Porteiros / Zeladores / Funcionários).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { matchesSearch, filterPessoasPorBusca, type PessoaSearchable } from "../pessoas-search";

// ════════════ FIXTURES ════════════

const pessoas: PessoaSearchable[] = [
  {
    nome: "João da Silva",
    email: "joao.silva@example.com",
    role: "MORADOR",
    blocoId: "Bloco A",
    unidadeId: "203",
    status: "ATIVO",
  },
  {
    nome: "Maria Souza",
    email: "maria@example.com",
    role: "SINDICO",
    blocoId: "Bloco B",
    unidadeId: "101",
    status: "ATIVO",
  },
  {
    nome: "Carlos Pereira",
    email: "carlos.pereira@example.com",
    role: "PORTEIRO",
    blocoId: "ADM",
    unidadeId: "ADMINISTRACAO",
    status: "INATIVO",
  },
  {
    nome: "Ana Ramos",
    email: "ana.ramos@example.com",
    role: "ZELADOR",
    tipo: "FUNCIONARIO",
    funcionarioTipo: "LIMPEZA",
    blocoId: "ADM",
    unidadeId: "ADMINISTRACAO",
    status: "ATIVO",
  },
];

// ════════════ MATCHESSEARCH ════════════

test("UICS01 nome exato — encontra por nome completo", () => {
  assert.equal(matchesSearch(pessoas[0], "João da Silva"), true);
});

test("UICS02 nome parcial — encontra por parte do nome", () => {
  assert.equal(matchesSearch(pessoas[0], "Silva"), true);
});

test("UICS03 case-insensitive — funciona independente de maiúsculas/minúsculas", () => {
  assert.equal(matchesSearch(pessoas[0], "joão"), true);
  assert.equal(matchesSearch(pessoas[0], "JOAO"), true);
});

test("UICS04 accent-insensitive — 'joao' encontra 'João'", () => {
  assert.equal(matchesSearch(pessoas[0], "joao"), true);
});

test("UICS05 email — encontra por e-mail parcial", () => {
  assert.equal(matchesSearch(pessoas[1], "maria@example"), true);
  assert.equal(matchesSearch(pessoas[0], "maria@example"), false);
});

test("UICS06 role/tipo — encontra por papel", () => {
  assert.equal(matchesSearch(pessoas[1], "sindico"), true);
  assert.equal(matchesSearch(pessoas[0], "sindico"), false);
});

test("UICS07 status — 'inativo' encontra registros INATIVO", () => {
  assert.equal(matchesSearch(pessoas[2], "inativo"), true);
  assert.equal(matchesSearch(pessoas[0], "inativo"), false);
});

test("UICS08 bloco — encontra por bloco", () => {
  assert.equal(matchesSearch(pessoas[0], "bloco a"), true);
  assert.equal(matchesSearch(pessoas[1], "bloco a"), false);
});

test("UICS09 unidade — encontra por número de unidade", () => {
  assert.equal(matchesSearch(pessoas[0], "203"), true);
  assert.equal(matchesSearch(pessoas[1], "203"), false);
});

test("UICS10 sem resultado — termo que não corresponde a nenhum campo", () => {
  assert.equal(matchesSearch(pessoas[0], "xyzxyz"), false);
});

test("UICS11 termo vazio — sempre corresponde (comportamento sem busca)", () => {
  assert.equal(matchesSearch(pessoas[0], ""), true);
  assert.equal(matchesSearch(pessoas[0], "   "), true);
});

test("UICS12 trim — espaços nas pontas não afetam o resultado", () => {
  assert.equal(matchesSearch(pessoas[0], "  silva  "), true);
});

// ════════════ FILTERPESSOASPORBUSCA (busca + filtro combinados) ════════════

test("UICS13 busca vazia = comportamento apenas do filtro de papel (lista completa)", () => {
  const resultado = filterPessoasPorBusca(pessoas, "");
  assert.equal(resultado.length, pessoas.length);
});

test("UICS14 busca + filtro Moradores — só retorna MORADOR cujo campo bate", () => {
  const moradores = pessoas.filter((p) => p.role === "MORADOR");
  const resultado = filterPessoasPorBusca(moradores, "203");
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].nome, "João da Silva");
});

test("UICS15 busca + filtro Porteiros — só retorna PORTEIRO cujo campo bate", () => {
  const porteiros = pessoas.filter((p) => p.role === "PORTEIRO");
  const resultado = filterPessoasPorBusca(porteiros, "carlos");
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].nome, "Carlos Pereira");
});

test("UICS16 trocar filtro mantendo o termo — mesmo termo aplicado a subconjuntos diferentes", () => {
  const moradores = pessoas.filter((p) => p.role === "MORADOR");
  const sindicos = pessoas.filter((p) => p.role === "SINDICO");
  assert.equal(filterPessoasPorBusca(moradores, "adm").length, 0);
  assert.equal(filterPessoasPorBusca(sindicos, "adm").length, 0);
});

test("UICS17 INATIVO ainda aparece quando busca/filtro permitem", () => {
  const porteiros = pessoas.filter((p) => p.role === "PORTEIRO");
  const resultado = filterPessoasPorBusca(porteiros, "");
  assert.equal(resultado.some((p) => p.status === "INATIVO"), true);
});

test("UICS18 nenhum resultado — termo não bate com nenhum item do subconjunto filtrado", () => {
  const moradores = pessoas.filter((p) => p.role === "MORADOR");
  const resultado = filterPessoasPorBusca(moradores, "zzz-nao-existe");
  assert.equal(resultado.length, 0);
});

test("UICS19 limpar busca retorna ao filtro de papel original, sem resetar o chip", () => {
  const moradores = pessoas.filter((p) => p.role === "MORADOR");
  const comBusca = filterPessoasPorBusca(moradores, "203");
  const semBusca = filterPessoasPorBusca(moradores, "");
  assert.equal(comBusca.length, 1);
  assert.equal(semBusca.length, moradores.length);
});
