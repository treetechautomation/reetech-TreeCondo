/**
 * P1.0 — Etapa 2 — TESTES DE DOMÍNIO — categoriaPessoa / moraNoCondominio
 *
 * Cobre a proteção crítica: MORADOR (role) continua exigindo unidade
 * residencial independentemente de categoriaPessoa/moraNoCondominio.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isResident,
  hasResidentialLink,
  requiresResidentialUnit,
  isProfessionalSyndic,
  isAdministrator,
  isEmployee,
  type PessoaVinculoSnapshot,
} from "../rules";

function snapshot(overrides: Partial<PessoaVinculoSnapshot>): PessoaVinculoSnapshot {
  return {
    role: null,
    categoriaPessoa: null,
    moraNoCondominio: null,
    blocoId: null,
    unidadeId: null,
    ...overrides,
  };
}

// ════════════ CASO LEGADO — sem categoriaPessoa/moraNoCondominio ════════════

test("caso legado — snapshot sem categoriaPessoa/moraNoCondominio continua válido", () => {
  const pessoa = snapshot({ role: "PORTEIRO" });
  assert.equal(pessoa.categoriaPessoa, null);
  assert.equal(pessoa.moraNoCondominio, null);
  assert.equal(isResident(pessoa), false);
  assert.equal(requiresResidentialUnit(pessoa), false);
});

// ════════════ MORADOR — categoriaPessoa/moraNoCondominio preenchidos ════════════

test("morador completo — role=MORADOR, categoriaPessoa=MORADOR, moraNoCondominio=true exige unidade", () => {
  const pessoa = snapshot({
    role: "MORADOR",
    categoriaPessoa: "MORADOR",
    moraNoCondominio: true,
  });
  assert.equal(isResident(pessoa), true);
  assert.equal(requiresResidentialUnit(pessoa), true);
});

// ════════════ MORADOR LEGADO — proteção CRÍTICA ════════════

test("CRÍTICO — morador legado (moraNoCondominio ausente) continua exigindo unidade", () => {
  const pessoa = snapshot({ role: "MORADOR", moraNoCondominio: null });
  assert.equal(requiresResidentialUnit(pessoa), true);
});

test("CRÍTICO — moraNoCondominio=false NUNCA dispensa role=MORADOR de exigir unidade", () => {
  const pessoa = snapshot({ role: "MORADOR", moraNoCondominio: false });
  assert.equal(requiresResidentialUnit(pessoa), true);
});

// ════════════ NÃO RESIDENTE — representável, sem autorização implícita ════════════

test("não residente — categoriaPessoa=ADMINISTRADORA, moraNoCondominio=false é representável", () => {
  const pessoa = snapshot({
    role: "ADMIN",
    categoriaPessoa: "ADMINISTRADORA",
    moraNoCondominio: false,
  });
  assert.equal(isAdministrator(pessoa), true);
  assert.equal(isResident(pessoa), false);
  assert.equal(requiresResidentialUnit(pessoa), false);
});

// ════════════ SÍNDICO PROFISSIONAL — representável, sem autorização implícita ════════════

test("síndico profissional — role=SINDICO, categoriaPessoa=SINDICO_PROFISSIONAL, moraNoCondominio=false é representável", () => {
  const pessoa = snapshot({
    role: "SINDICO",
    categoriaPessoa: "SINDICO_PROFISSIONAL",
    moraNoCondominio: false,
  });
  assert.equal(isProfessionalSyndic(pessoa), true);
  assert.equal(isResident(pessoa), false);
  assert.equal(requiresResidentialUnit(pessoa), false);
});

// ════════════ FUNCIONÁRIO — representável ════════════

test("funcionário — categoriaPessoa=FUNCIONARIO é representável e não implica moradia", () => {
  const pessoa = snapshot({
    role: "ZELADOR",
    categoriaPessoa: "FUNCIONARIO",
    moraNoCondominio: false,
  });
  assert.equal(isEmployee(pessoa), true);
  assert.equal(isResident(pessoa), false);
});

// ════════════ NENHUMA COMBINAÇÃO GERA AUTORIZAÇÃO ════════════

test("nenhuma função do domínio retorna algo além de boolean (nunca decide RBAC/ACL)", () => {
  const pessoa = snapshot({
    role: "MORADOR",
    categoriaPessoa: "MORADOR",
    moraNoCondominio: true,
    blocoId: "b1",
    unidadeId: "u1",
  });
  for (const fn of [isResident, hasResidentialLink, requiresResidentialUnit, isProfessionalSyndic, isAdministrator, isEmployee]) {
    assert.equal(typeof fn(pessoa), "boolean");
  }
});
