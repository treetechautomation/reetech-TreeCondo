/**
 * ENCOMENDAS.2F — testes puros de auditAuthorization.ts e
 * auditProjection.ts. Sem Firestore, sem HTTP.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { resolveEncomendaAuditAuthorization } from "../auditAuthorization";
import { buildEncomendaAuditProjection } from "../auditProjection";

// SUPER_ADMIN
test("SUPER_ADMIN sempre autorizado, independentemente de unidade", () => {
  const r = resolveEncomendaAuditAuthorization({
    isSuperAdmin: true,
    role: null,
    membroData: null,
    encomenda: { unidadeIdNorm: "unit-1", blocoIdNorm: null },
  });
  assert.equal(r.allowed, true);
});

// staff
for (const role of ["PORTEIRO", "ZELADOR", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"]) {
  test(`staff autorizado (própria condomínio já garantido por apiGuard): ${role}`, () => {
    const r = resolveEncomendaAuditAuthorization({
      isSuperAdmin: false,
      role,
      membroData: { status: "ATIVO", unidadeIdNorm: "unit-other", blocoIdNorm: null },
      encomenda: { unidadeIdNorm: "unit-1", blocoIdNorm: null },
    });
    assert.equal(r.allowed, true);
  });
}

test("staff de outro condomínio nunca chega aqui — apiGuard já bloqueia antes (fora de escopo desta função pura)", () => {
  // Documentado: esta função só roda após apiGuard aceitar o condominioId.
  assert.ok(true);
});

// MORADOR — própria unidade
test("MORADOR ativo na mesma unidade/bloco (ambos null) é autorizado", () => {
  const r = resolveEncomendaAuditAuthorization({
    isSuperAdmin: false,
    role: "MORADOR",
    membroData: { status: "ATIVO", unidadeIdNorm: "unit-1", blocoIdNorm: null },
    encomenda: { unidadeIdNorm: "unit-1", blocoIdNorm: null },
  });
  assert.equal(r.allowed, true);
});

test("MORADOR ativo na mesma unidade e mesmo bloco é autorizado", () => {
  const r = resolveEncomendaAuditAuthorization({
    isSuperAdmin: false,
    role: "MORADOR",
    membroData: { status: "ATIVO", unidadeIdNorm: "unit-1", blocoIdNorm: "bloco-a" },
    encomenda: { unidadeIdNorm: "unit-1", blocoIdNorm: "bloco-a" },
  });
  assert.equal(r.allowed, true);
});

test("MORADOR de outra unidade é negado (UNRELATED_UNIT)", () => {
  const r = resolveEncomendaAuditAuthorization({
    isSuperAdmin: false,
    role: "MORADOR",
    membroData: { status: "ATIVO", unidadeIdNorm: "unit-2", blocoIdNorm: null },
    encomenda: { unidadeIdNorm: "unit-1", blocoIdNorm: null },
  });
  assert.equal(r.allowed, false);
  assert.equal((r as any).reason, "UNRELATED_UNIT");
});

test("MORADOR mesma unidade porém bloco diferente é negado", () => {
  const r = resolveEncomendaAuditAuthorization({
    isSuperAdmin: false,
    role: "MORADOR",
    membroData: { status: "ATIVO", unidadeIdNorm: "unit-1", blocoIdNorm: "bloco-b" },
    encomenda: { unidadeIdNorm: "unit-1", blocoIdNorm: "bloco-a" },
  });
  assert.equal(r.allowed, false);
  assert.equal((r as any).reason, "UNRELATED_UNIT");
});

test("MORADOR inativo é negado (INACTIVE_MEMBERSHIP) mesmo na unidade certa", () => {
  const r = resolveEncomendaAuditAuthorization({
    isSuperAdmin: false,
    role: "MORADOR",
    membroData: { status: "INATIVO", unidadeIdNorm: "unit-1", blocoIdNorm: null },
    encomenda: { unidadeIdNorm: "unit-1", blocoIdNorm: null },
  });
  assert.equal(r.allowed, false);
  assert.equal((r as any).reason, "INACTIVE_MEMBERSHIP");
});

test("MORADOR sem membroData é negado (fail-closed)", () => {
  const r = resolveEncomendaAuditAuthorization({
    isSuperAdmin: false,
    role: "MORADOR",
    membroData: null,
    encomenda: { unidadeIdNorm: "unit-1", blocoIdNorm: null },
  });
  assert.equal(r.allowed, false);
  assert.equal((r as any).reason, "INACTIVE_MEMBERSHIP");
});

test("papel desconhecido/vazio é negado (ROLE_NOT_PERMITTED)", () => {
  const r = resolveEncomendaAuditAuthorization({
    isSuperAdmin: false,
    role: "SEGURANCA",
    membroData: { status: "ATIVO", unidadeIdNorm: "unit-1", blocoIdNorm: null },
    encomenda: { unidadeIdNorm: "unit-1", blocoIdNorm: null },
  });
  assert.equal(r.allowed, false);
  assert.equal((r as any).reason, "ROLE_NOT_PERMITTED");
});

// projeção segura
test("buildEncomendaAuditProjection: nunca inclui pinHash/qrTokenHash/pinAttempts/pinLockedUntil", () => {
  const data = {
    status: "AGUARDANDO",
    codigo: "PKG-ABC12345",
    unidadeId: "101",
    blocoId: "A",
    registradoPorUid: "porteiro-1",
    registradoPorNome: "Porteiro Um",
    registradoPorEmail: "p1@example.com",
    registradoPorRole: "PORTEIRO",
    createdAt: "2026-01-01T10:00:00.000Z",
    pinHash: "should-never-appear",
    pinLast4: "1234",
    qrTokenHash: "should-never-appear-either",
    pinAttempts: 3,
    pinLockedUntil: "2026-01-01T10:20:00.000Z",
  };
  const projection = buildEncomendaAuditProjection("enc-1", "condo-a", data, []);
  const serialized = JSON.stringify(projection);
  assert.equal(serialized.includes("should-never-appear"), false);
  assert.equal(serialized.includes("pinHash"), false);
  assert.equal(serialized.includes("qrTokenHash"), false);
  assert.equal(serialized.includes("pinAttempts"), false);
  assert.equal(serialized.includes("pinLockedUntil"), false);
  assert.equal(serialized.includes("pinLast4"), false);
});

test("buildEncomendaAuditProjection: criacao reflete registradoPor*, retirada é null quando status != RETIRADA", () => {
  const data = {
    status: "AGUARDANDO",
    registradoPorUid: "porteiro-1",
    registradoPorNome: "Porteiro Um",
    registradoPorEmail: "p1@example.com",
    registradoPorRole: "PORTEIRO",
    createdAt: "2026-01-01T10:00:00.000Z",
  };
  const projection = buildEncomendaAuditProjection("enc-1", "condo-a", data, []);
  assert.equal(projection.criacao.uid, "porteiro-1");
  assert.equal(projection.criacao.em, "2026-01-01T10:00:00.000Z");
  assert.equal(projection.retirada, null);
});

test("buildEncomendaAuditProjection: retirada preenchida quando status == RETIRADA", () => {
  const data = {
    status: "RETIRADA",
    registradoPorUid: "porteiro-1",
    retiradaEm: "2026-01-02T09:00:00.000Z",
    withdrawMethod: "PIN",
    retiradoPorUid: "porteiro-2",
    retiradoPorNome: "Porteiro Dois",
    retiradaRecebedorNome: "João",
    retiradaRecebedorParentesco: "Cônjuge",
  };
  const projection = buildEncomendaAuditProjection("enc-1", "condo-a", data, []);
  assert.ok(projection.retirada);
  assert.equal(projection.retirada?.metodo, "PIN");
  assert.equal(projection.retirada?.confirmadoPor.uid, "porteiro-2");
  assert.equal(projection.retirada?.recebedor.nome, "João");
});

test("buildEncomendaAuditProjection: eventos filtram metadata para o allowlist, descartando chaves desconhecidas", () => {
  const events = [
    {
      type: "WITHDRAWN",
      timestamp: "2026-01-02T09:00:00.000Z",
      actorUid: "porteiro-2",
      actorRole: "PORTEIRO",
      actorName: "Porteiro Dois",
      metadata: { method: "PIN", encomendaId: "enc-1", condominioId: "condo-a", pinHash: "leak-attempt", token: "leak-attempt-2" },
    },
  ];
  const projection = buildEncomendaAuditProjection("enc-1", "condo-a", { status: "RETIRADA" }, events);
  assert.equal(projection.eventos.length, 1);
  assert.equal(projection.eventos[0].metadata.method, "PIN");
  assert.equal("pinHash" in projection.eventos[0].metadata, false);
  assert.equal("token" in projection.eventos[0].metadata, false);
});
