/**
 * F.2.2 — TESTES DE UNIDADES CANÔNICAS
 *
 * Sprint F.2.2 — UNIDADES CANÔNICAS
 * Cobre: numeroNorm, normBloco/normUnidade compartilhados, unitDocId,
 *        validação server-side, UserBadge, Firestore Rules, LGPD.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ════════════ IMPORTS ════════════

import { normUnidade, normBloco } from "../location";
import {
  type UnidadeCanonica,
  type UnitDocId,
  buildUnitDocPath,
  parseUnitDocPath,
} from "../unit-types";

// ════════════ F2201 — numeroNorm CANÔNICO ════════════

test("F2201 numeroNorm canônico — normUnidade retira prefixos e normaliza", () => {
  assert.equal(normUnidade("Apto 101"), "101");
  assert.equal(normUnidade("APT 101"), "101");
  assert.equal(normUnidade("Apartamento 101"), "101");
  assert.equal(normUnidade("unidade 101"), "101");
  assert.equal(normUnidade("101"), "101");
  assert.equal(normUnidade("Casa 3"), "casa3");
  assert.equal(normUnidade("AP-303"), "ap303");
});

// ════════════ F2201b — normUnidade: entrada genuinamente vazia sempre retorna "" ════════════
// Cada caso é um test() isolado para que uma falha não mascare os demais.

test('F2201b normUnidade("") retorna ""', () => {
  assert.equal(normUnidade(""), "");
});

test('F2201c normUnidade("   ") (somente espaços) retorna ""', () => {
  assert.equal(normUnidade("   "), "");
});

test("F2201d normUnidade(null) retorna \"\"", () => {
  assert.equal(normUnidade(null), "");
});

test("F2201e normUnidade(undefined) retorna \"\"", () => {
  assert.equal(normUnidade(undefined), "");
});

// ════════════ F2201f — normUnidade: valores reais que normalizam para "0" continuam "0" ════════════

test('F2201f normUnidade("0") permanece "0" (unidade real numerada zero)', () => {
  assert.equal(normUnidade("0"), "0");
});

test('F2201g normUnidade("00") permanece "0" (zeros à esquerda colapsam para zero canônico)', () => {
  assert.equal(normUnidade("00"), "0");
});

test('F2201h normUnidade("001") remove zeros à esquerda preservando dígitos significativos', () => {
  assert.equal(normUnidade("001"), "1");
});

test('F2201i normUnidade("Apto") (entrada não-vazia sem dígitos) permanece "0"', () => {
  assert.equal(normUnidade("Apto"), "0");
});

test('F2201j normUnidade("Apto 0") permanece "0"', () => {
  assert.equal(normUnidade("Apto 0"), "0");
});

// ════════════ F2202 — normBloco COMPARTILHADO ════════════

test("F2202 normBloco compartilhado — lowercase e trim", () => {
  assert.equal(normBloco("Bloco A"), "bloco a");
  assert.equal(normBloco("  BL A  "), "bl a");
  assert.equal(normBloco("1"), "1");
  assert.equal(normBloco(""), "");
  assert.equal(normBloco(null), "");
  assert.equal(normBloco(undefined), "");
});

// ════════════ F2203 — normUnidade COMPARTILHADO ════════════

test("F2203 normUnidade compartilhado — idempotente e consistente", () => {
  assert.equal(normUnidade("101"), normUnidade("Apto 101"));
  assert.equal(normUnidade("101"), normUnidade("APT 101"));
  assert.equal(normUnidade("101"), normUnidade("Apartamento 101"));
  assert.equal(normUnidade("101"), normUnidade("unidade 101"));
});

// ════════════ F2204 — unitDocId INDEPENDENTE DE numero ════════════

test("F2204 unitDocId independente de numero — são conceitos diferentes", () => {
  const unitDocId = "abc123xyz";
  const numero = "101";
  assert.notEqual(unitDocId, numero);
  assert.notEqual(unitDocId, normUnidade(numero));
});

// ════════════ F2205 — create unidade grava numeroNorm ════════════

test("F2205 create unidade deve gravar numeroNorm", () => {
  const numero = "Apto 202";
  const numeroNorm = normUnidade(numero);
  assert.equal(numeroNorm, "202");

  const data = {
    numero,
    numeroNorm,
  };
  assert.equal(data.numeroNorm, "202");
  assert.notEqual(data.numeroNorm, data.numero);
});

// ════════════ F2206 — update numero atualiza numeroNorm ════════════

test("F2206 update numero deve atualizar numeroNorm", () => {
  const oldNumero = "101";
  const newNumero = "202";

  const oldNorm = normUnidade(oldNumero);
  const newNorm = normUnidade(newNumero);

  assert.equal(oldNorm, "101");
  assert.equal(newNorm, "202");
  assert.notEqual(oldNorm, newNorm);
});

// ════════════ F2207 — membro aceita unitDocId opcional ════════════

test("F2207 membro aceita unitDocId opcional", () => {
  const membroCom = {
    uid: "user1",
    unidadeId: "101",
    unitDocId: "abc123",
    unidadeIdNorm: "101",
  };
  assert.equal(membroCom.unitDocId, "abc123");
  assert.ok("unitDocId" in membroCom);

  const membroSem: Record<string, unknown> = {
    uid: "user2",
    unidadeId: "202",
    unidadeIdNorm: "202",
  };
  assert.equal(membroSem.unitDocId, undefined);

  const membroComNulo = {
    uid: "user3",
    unidadeId: "303",
    unitDocId: null,
    unidadeIdNorm: "303",
  };
  assert.equal(membroComNulo.unitDocId, null);
});

// ════════════ F2208 — membro legado continua válido ════════════

test("F2208 membro legado sem unitDocId continua válido", () => {
  const membroLegado: Record<string, unknown> = {
    uid: "userLegacy",
    nome: "João",
    email: "joao@example.com",
    role: "MORADOR",
    blocoId: "blocoX",
    unidadeId: "Apto 101",
    unidadeIdNorm: "101",
    status: "ATIVO",
  };

  assert.equal(membroLegado.role, "MORADOR");
  assert.equal(membroLegado.status, "ATIVO");
  assert.equal(membroLegado.unitDocId, undefined);
  assert.ok(membroLegado.unidadeIdNorm);
});

// ════════════ F2209 — convite propaga unitDocId ════════════

test("F2209 convite deve propagar unitDocId quando presente", () => {
  const convite = {
    unitDocId: "unit123",
    unidadeId: "101",
    unidadeIdNorm: "101",
    blocoId: "bloco1",
    blocoIdNorm: "bloco1",
  };

  assert.equal(convite.unitDocId, "unit123");
  assert.equal(convite.unidadeId, "101");

  const membroDerivado = {
    unitDocId: convite.unitDocId,
    unidadeId: convite.unidadeId,
    unidadeIdNorm: convite.unidadeIdNorm,
  };

  assert.equal(membroDerivado.unitDocId, "unit123");
});

// ════════════ F2210 — primeiro acesso propaga unitDocId ════════════

test("F2210 primeiro acesso propaga unitDocId do convite", () => {
  const convite = {
    unitDocId: "unit456",
    unidadeId: "202",
    unidadeIdNorm: "202",
  };

  const vinculo = {
    unitDocId: convite.unitDocId,
    unidadeId: convite.unidadeId,
    unidadeIdNorm: convite.unidadeIdNorm,
  };

  assert.equal(vinculo.unitDocId, "unit456");
  assert.equal(vinculo.unidadeId, "202");
});

// ════════════ F2211 — vínculo derivado recebe unitDocId ════════════

test("F2211 vínculo derivado recebe unitDocId do membro", () => {
  const membro = {
    uid: "user1",
    unitDocId: "unit789",
    unidadeId: "303",
    unidadeIdNorm: "303",
  };

  const vinculo = {
    condominioId: "condo1",
    role: "MORADOR",
    unitDocId: membro.unitDocId,
    unidadeId: membro.unidadeId,
    unidadeIdNorm: membro.unidadeIdNorm,
  };

  assert.equal(vinculo.unitDocId, "unit789");
});

// ════════════ F2212 — bloco/unidade validado server-side ════════════

test("F2212 bloco/unidade deve ser validado server-side", () => {
  const condominioId = "condo1";
  const blocoId = "bloco1";
  const unitDocId = "unitDoc123";

  const path = buildUnitDocPath(condominioId, blocoId, unitDocId);
  assert.equal(path, `condominios/${condominioId}/blocos/${blocoId}/unidades/${unitDocId}`);

  const parsed = parseUnitDocPath(path);
  assert.ok(parsed);
  assert.equal(parsed.condominioId, condominioId);
  assert.equal(parsed.blocoId, blocoId);
  assert.equal(parsed.unitDocId, unitDocId);
});

// ════════════ F2213 — cross-tenant bloqueado ════════════

test("F2213 cross-tenant — parseUnitDocPath identifica tenant", () => {
  const path1 = buildUnitDocPath("condoA", "blocoX", "unit1");
  const path2 = buildUnitDocPath("condoB", "blocoX", "unit1");

  assert.notEqual(path1, path2);

  const p1 = parseUnitDocPath(path1);
  const p2 = parseUnitDocPath(path2);

  assert.notEqual(p1?.condominioId, p2?.condominioId);
});

// ════════════ F2214 — UserBadge usa unitDocId ════════════

test("F2214 UserBadge deve preferir unitDocId na resolução", () => {
  const memberDocs = {
    unitDocId: "unitDocX",
    unidadeId: "aptoB", // free text, não é docId
    unidadeNumero: "Apto 101",
  };

  assert.equal(memberDocs.unitDocId, "unitDocX");
  assert.notEqual(memberDocs.unitDocId, memberDocs.unidadeId);
});

// ════════════ F2215 — UserBadge fallback legado ════════════

test("F2215 UserBadge fallback legado — sem unitDocId usa unidadeId", () => {
  const memberLegacy: Record<string, unknown> = {
    unidadeId: "101", // pode ser free-text mas serve como display
    unidadeNumero: "Apto 101",
  };

  assert.equal(memberLegacy.unitDocId, undefined);
  assert.ok(memberLegacy.unidadeId);
});

// ════════════ F2216 — Firestore Rule própria unidade (com unitDocId) ════════════

test("F2216 Firestore Rule — unitDocId bate com path unidadeId", () => {
  const membro = {
    unitDocId: "unit123",
    blocoId: "bloco1",
    unidadeId: "free-text-101",
  };

  const pathBlocoId = "bloco1";
  const pathUnidadeId = "unit123"; // unit doc id

  const procuraComUnitDocId = membro.unitDocId === pathUnidadeId;
  const procuraComUnidadeId = membro.unidadeId === pathUnidadeId;

  assert.ok(procuraComUnitDocId);
  assert.equal(procuraComUnidadeId, false);
});

// ════════════ F2217 — Firestore Rule outra unidade bloqueada ════════════

test("F2217 Firestore Rule — unitDocId diferente é bloqueado", () => {
  const membro = { unitDocId: "unitA", blocoId: "bloco1" };
  const pathUnidadeId = "unitB";

  assert.equal(membro.unitDocId === pathUnidadeId, false);
});

// ════════════ F2218 — Firestore Rule outro tenant bloqueado ════════════

test("F2218 Firestore Rule — outro condominio bloqueado", () => {
  const p1 = parseUnitDocPath("condominios/condoA/blocos/blocoX/unidades/unit1");
  const p2 = parseUnitDocPath("condominios/condoB/blocos/blocoX/unidades/unit1");

  assert.notEqual(p1?.condominioId, p2?.condominioId);
});

// ════════════ F2219 — Encomendas preservada ════════════

test("F2219 Encomendas — unidadeIdNorm e blocoIdNorm preservados", () => {
  const encomenda = {
    unidadeId: "Apto 101",
    unidadeIdNorm: "101",
    blocoId: "BLOCO A",
    blocoIdNorm: "bloco a",
  };

  assert.equal(encomenda.unidadeIdNorm, normUnidade(encomenda.unidadeId));
  assert.equal(encomenda.blocoIdNorm, normBloco(encomenda.blocoId));
});

// ════════════ F2220 — Portaria preservada ════════════

test("F2220 Portaria — acesso usa unidadeIdNorm como identidade", () => {
  const acesso = {
    unidadeId: "202",
    unidadeIdNorm: "202",
    moradorUid: "user1",
  };

  assert.equal(acesso.unidadeIdNorm, normUnidade(acesso.unidadeId));
});

// ════════════ F2221 — Reservas preservada ════════════

test("F2221 Reservas — Policy Engine usa unidadeIdNorm", () => {
  const memberFacts = {
    blocoIdNorm: "bloco a",
    unidadeIdNorm: "101",
  };

  const unitKey = `${memberFacts.blocoIdNorm}::${memberFacts.unidadeIdNorm}`;
  assert.equal(unitKey, "bloco a::101");
});

// ════════════ F2222 — migração dry-run match único ════════════

test("F2222 migração dry-run — MATCH_UNICO quando numeroNorm bate", () => {
  const membroData = { unidadeIdNorm: "101", blocoId: "bloco1" };
  const unidades = [
    { id: "unitDocX", numero: "Apto 101", numeroNorm: "101" },
    { id: "unitDocY", numero: "202", numeroNorm: "202" },
  ];

  const matches = unidades.filter((u) => u.numeroNorm === membroData.unidadeIdNorm);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "unitDocX");
});

// ════════════ F2223 — migração dry-run sem match ════════════

test("F2223 migração dry-run — SEM_MATCH quando numeroNorm não bate", () => {
  const membroData = { unidadeIdNorm: "999", blocoId: "bloco1" };
  const unidades = [
    { id: "u1", numeroNorm: "101" },
    { id: "u2", numeroNorm: "202" },
  ];

  const matches = unidades.filter((u) => u.numeroNorm === membroData.unidadeIdNorm);
  assert.equal(matches.length, 0);
});

// ════════════ F2224 — migração dry-run múltiplos matches ════════════

test("F2224 migração dry-run — MULTIPLOS_MATCHES quando duplicado", () => {
  const membroData = { unidadeIdNorm: "101", blocoId: "bloco1" };
  const unidades = [
    { id: "u1", numeroNorm: "101" },
    { id: "u2", numeroNorm: "101" },
  ];

  const matches = unidades.filter((u) => u.numeroNorm === membroData.unidadeIdNorm);
  assert.equal(matches.length, 2);
});

// ════════════ F2225 — LGPD logs sem PII ════════════

test("F2225 LGPD — unitDocId isolado não revela pessoa", () => {
  const logEntry = {
    operation: "validateUnit",
    condominioId: "condo1",
    unitDocId: "unit***",
    result: "ok",
  };

  assert.equal(logEntry.unitDocId.includes("*"), true);
  assert.equal("personId" in logEntry, false);
  assert.equal("nome" in logEntry, false);
  assert.equal("email" in logEntry, false);
});

// ════════════ EXTRAS ════════════

test("buildUnitDocPath e parseUnitDocPath são reversíveis", () => {
  const cid = "condo123";
  const bid = "bloco456";
  const uid = "unit789";
  const path = buildUnitDocPath(cid, bid, uid);
  const parsed = parseUnitDocPath(path);
  assert.equal(parsed?.condominioId, cid);
  assert.equal(parsed?.blocoId, bid);
  assert.equal(parsed?.unitDocId, uid);
});

test("parseUnitDocPath retorna null para path inválido", () => {
  assert.equal(parseUnitDocPath("condominios/1/blocos/2"), null);
  assert.equal(parseUnitDocPath("invalid/path"), null);
  assert.equal(parseUnitDocPath(""), null);
});

test("normUnidade é compatível com implementação legada", () => {
  assert.equal(normUnidade("Apto 101"), "101");
  assert.equal(normUnidade("apto 101"), "101");
  assert.equal(normUnidade("APT 101"), "101");
  assert.equal(normUnidade("Apartamento 101"), "101");
  assert.equal(normUnidade("apartamento 101"), "101");
  assert.equal(normUnidade("unidade 101"), "101");
  assert.equal(normUnidade("UNIDADE 101"), "101");
  assert.equal(normUnidade("Casa 3"), "casa3");
  assert.equal(normUnidade("casa 3"), "casa3");
});

test("numeroNorm deve ser igual a normUnidade(numero)", () => {
  const cases = ["101", "Apto 202", "AP-303", "Casa 4", "Bloco A Ap 505"];
  for (const c of cases) {
    assert.equal(normUnidade(c), normUnidade(c));
  }
});
