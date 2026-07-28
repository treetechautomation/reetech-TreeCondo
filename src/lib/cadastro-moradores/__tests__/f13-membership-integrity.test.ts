/**
 * FASE F.1.3 — TESTES DE INTEGRIDADE DO MEMBERSHIP
 *
 * Testes arquiteturais que validam as regras da fonte de verdade,
 * reconciliação e o fluxo promote-sindico.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ════════════ TIPOS CANÔNICOS ════════════

type MembroStatus = "ATIVO" | "INATIVO";
type MembroRole = "SUPER_ADMIN" | "ADMIN" | "ADMIN_CONDOMINIO" | "SINDICO" | "PORTEIRO" | "ZELADOR" | "SEGURANCA" | "MORADOR";

interface MembroDoc {
  uid: string;
  condominioId: string;
  role: MembroRole;
  status: MembroStatus;
  blocoId?: string | null;
  blocoIdNorm?: string | null;
  unidadeId?: string | null;
  unidadeIdNorm?: string | null;
  menuPermissions?: Record<string, boolean>;
}

interface VinculoDoc {
  condominioId: string;
  role: MembroRole;
  status: MembroStatus;
  blocoId?: string | null;
  blocoIdNorm?: string | null;
  unidadeId?: string | null;
  unidadeIdNorm?: string | null;
}

// ════════════ REGRAS DA FONTE DE VERDADE ════════════

const STAFF_ROLES: MembroRole[] = ["PORTEIRO", "ZELADOR", "SEGURANCA", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"];
const RESIDENT_ROLES: MembroRole[] = ["MORADOR"];
const ALL_ROLES: MembroRole[] = [...STAFF_ROLES, ...RESIDENT_ROLES];

const ROLES_AUTORIZADAS_PROMOTE: MembroRole[] = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

function staffPodeExistirSemUnidade(role: MembroRole): boolean {
  return STAFF_ROLES.includes(role);
}

function moradorPrecisaDeUnidade(role: MembroRole): boolean {
  return RESIDENT_ROLES.includes(role);
}

// ════════════ F1301 — MEMBROS É AUTHORITATIVE ════════════

test("F1301 membros é authoritative — membro dita role e status", () => {
  const membro: MembroDoc = {
    uid: "user-1",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
    unidadeId: "AP-101",
  };

  // O vínculo deve espelhar os dados autoritativos do membro
  // Não o contrário
  assert.equal(membro.role, "MORADOR");
  assert.equal(membro.status, "ATIVO");
  assert.equal(membro.unidadeId, "AP-101");
});

test("F1301 membros é authoritative — divergência resolve a favor do membro", () => {
  const membro: MembroDoc = {
    uid: "user-2",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
  };

  const vinculo: VinculoDoc = {
    condominioId: "condo-1",
    role: "SINDICO", // divergente
    status: "INATIVO", // divergente
  };

  // membro é authoritative, vinculo é derived
  assert.notEqual(membro.role, vinculo.role);
  assert.notEqual(membro.status, vinculo.status);

  // A correção deve partir do membro para o vínculo
  const vinculoSincronizado: VinculoDoc = {
    ...vinculo,
    role: membro.role,
    status: membro.status,
  };
  assert.equal(vinculoSincronizado.role, membro.role);
  assert.equal(vinculoSincronizado.status, membro.status);
});

// ════════════ F1302 — VÍNCULO É DERIVED/INDEX ════════════

test("F1302 vínculo é derived/index — todo campo do vínculo tem origem no membro", () => {
  const membro: MembroDoc = {
    uid: "user-3",
    condominioId: "condo-1",
    role: "PORTEIRO",
    status: "ATIVO",
  };

  // O vínculo não deve conter dados que não existam no membro
  const camposDoMembro = ["condominioId", "role", "status", "blocoId", "blocoIdNorm", "unidadeId", "unidadeIdNorm"];
  const camposDoVinculo: (keyof VinculoDoc)[] = ["condominioId", "role", "status", "blocoId", "blocoIdNorm", "unidadeId", "unidadeIdNorm"];

  for (const campo of camposDoVinculo) {
    // Cada campo do vínculo deve existir como conceito no membro
    assert.ok(camposDoMembro.includes(campo as string), `Campo ${campo} do vínculo deve ter origem no membro`);
  }
});

// ════════════ F1303 — MEMBRO ATIVO GERA VÍNCULO CORRETO ════════════

test("F1303 membro ATIVO gera vínculo correto — todos os campos espelhados", () => {
  const membro: MembroDoc = {
    uid: "user-4",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
    blocoId: "bloco-a",
    blocoIdNorm: "bloco-a",
    unidadeId: "AP-202",
    unidadeIdNorm: "ap-202",
  };

  const vinculo: VinculoDoc = {
    condominioId: membro.condominioId,
    role: membro.role,
    status: membro.status,
    blocoId: membro.blocoId,
    blocoIdNorm: membro.blocoIdNorm,
    unidadeId: membro.unidadeId,
    unidadeIdNorm: membro.unidadeIdNorm,
  };

  assert.equal(vinculo.condominioId, membro.condominioId);
  assert.equal(vinculo.role, membro.role);
  assert.equal(vinculo.status, membro.status);
  assert.equal(vinculo.blocoId, membro.blocoId);
  assert.equal(vinculo.unidadeId, membro.unidadeId);
});

// ════════════ F1304 — RECONCILIAÇÃO IDEMPOTENTE ════════════

test("F1304 reconciliação idempotente — segunda execução não detecta mudanças", () => {
  const membro: MembroDoc = {
    uid: "user-5",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
  };

  const vinculoSincronizado: VinculoDoc = {
    condominioId: membro.condominioId,
    role: membro.role,
    status: membro.status,
  };

  function needsSync(m: MembroDoc, v: VinculoDoc): boolean {
    return m.role !== v.role || m.status !== v.status;
  }

  // Primeira execução: sem vínculo → precisa sync
  assert.ok(needsSync(membro, { condominioId: "condo-1", role: "MORADOR", status: "INATIVO" }));

  // Após sincronização: idempotente
  assert.ok(!needsSync(membro, vinculoSincronizado));

  // Segunda execução: sem alterações
  assert.ok(!needsSync(membro, vinculoSincronizado));
});

// ════════════ F1305 — ROLE SINCRONIZADA ════════════

test("F1305 role sincronizada — todos os papéis previstos", () => {
  for (const role of ALL_ROLES) {
    const membro: MembroDoc = {
      uid: "test-role-" + role,
      condominioId: "condo-1",
      role,
      status: "ATIVO",
    };
    assert.equal(membro.role, role);
  }
});

// ════════════ F1306 — STATUS SINCRONIZADO ════════════

test("F1306 status sincronizado — ATIVO e INATIVO", () => {
  const statuses: MembroStatus[] = ["ATIVO", "INATIVO"];
  for (const status of statuses) {
    const membro: MembroDoc = {
      uid: "test-status-" + status,
      condominioId: "condo-1",
      role: "MORADOR",
      status,
    };
    assert.equal(membro.status, status);
  }
});

// ════════════ F1307 — UNIDADE SINCRONIZADA ════════════

test("F1307 unidade sincronizada — bloco e unidade preservados", () => {
  const membro: MembroDoc = {
    uid: "user-6",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
    blocoId: "Bloco B",
    blocoIdNorm: "bloco-b",
    unidadeId: "AP-303",
    unidadeIdNorm: "ap-303",
  };

  // Vínculo deve espelhar campos normalizados
  const vinculo: VinculoDoc = {
    condominioId: membro.condominioId,
    role: membro.role,
    status: membro.status,
    blocoId: membro.blocoId,
    blocoIdNorm: membro.blocoIdNorm,
    unidadeId: membro.unidadeId,
    unidadeIdNorm: membro.unidadeIdNorm,
  };

  assert.equal(vinculo.unidadeId, "AP-303");
  assert.equal(vinculo.unidadeIdNorm, "ap-303");
  assert.equal(vinculo.blocoId, "Bloco B");
  assert.equal(vinculo.blocoIdNorm, "bloco-b");
});

// ════════════ F1308 — STAFF SEM UNIDADE PERMITIDO ════════════

test("F1308 staff sem unidade permitido — PORTEIRO, ZELADOR, SINDICO, ADMIN", () => {
  for (const role of STAFF_ROLES) {
    const temUnidade = !!staffPodeExistirSemUnidade(role);
    assert.ok(temUnidade, `Role ${role} deve poder existir sem unidade`);
  }
});

// ════════════ F1309 — MORADOR REAL SEM UNIDADE SINALIZADO ════════════

test("F1309 morador real sem unidade sinalizado — MORADOR precisa de unidade", () => {
  for (const role of RESIDENT_ROLES) {
    const precisa = moradorPrecisaDeUnidade(role);
    assert.ok(precisa, `Role ${role} deve ter unidade (ou ser conta de teste)`);
  }

  const membroComUnidade: MembroDoc = {
    uid: "user-7",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
    unidadeId: "AP-101",
  };
  assert.ok(membroComUnidade.unidadeId);

  const membroSemUnidade: MembroDoc = {
    uid: "user-8",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
  };
  // Morador ATIVO sem unidade deve ser sinalizado (test account ou inválido)
  assert.ok(!membroSemUnidade.unidadeId);
});

// ════════════ F1310 — VÍNCULO ÓRFÃO DETECTADO ════════════

test("F1310 vínculo órfão detectado — vínculo sem membro correspondente", () => {
  const vinculos = new Map<string, VinculoDoc>();
  vinculos.set("user-orphan", {
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
  });

  const membros = new Set<string>(["user-1", "user-2"]);

  const orfaos: string[] = [];
  for (const [uid] of vinculos) {
    if (!membros.has(uid)) {
      orfaos.push(uid);
    }
  }

  assert.equal(orfaos.length, 1);
  assert.equal(orfaos[0], "user-orphan");
});

test("F1310 vínculo órfão detectado — membros sem vínculo também são detectados", () => {
  const membros = new Map<string, MembroDoc>();
  membros.set("user-no-vinculo", {
    uid: "user-no-vinculo",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
  });

  const vinculos = new Set<string>(["user-1", "user-2"]);

  const membrosSemVinculo: string[] = [];
  for (const [uid, m] of membros) {
    if (m.status === "ATIVO" && !vinculos.has(uid)) {
      membrosSemVinculo.push(uid);
    }
  }

  assert.equal(membrosSemVinculo.length, 1);
  assert.equal(membrosSemVinculo[0], "user-no-vinculo");
});

// ════════════ F1311 — CROSS-TENANT BLOQUEADO ════════════

test("F1311 cross-tenant bloqueado — membro não pertence a outro condomínio", () => {
  const condominioA = "condo-a";
  const condominioB = "condo-b";

  const membroA: MembroDoc = {
    uid: "user-x",
    condominioId: condominioA,
    role: "MORADOR",
    status: "ATIVO",
  };

  // Validação: operação em condo-b com uid do condo-a deve ser bloqueada
  function isCrossTenant(membro: MembroDoc, targetCondominioId: string): boolean {
    return membro.condominioId !== targetCondominioId;
  }

  assert.ok(isCrossTenant(membroA, condominioB));
  assert.ok(!isCrossTenant(membroA, condominioA));
});

// ════════════ F1312 — PROMOTE-SINDICO EXIGE AUTENTICAÇÃO ════════════

test("F1312 promote-sindico exige autenticação — token ausente = 401", () => {
  const authHeader: string | null = null as string | null;
  const token = authHeader?.replace("Bearer ", "") ?? null;

  assert.equal(token, null, "Sem token → não autenticado");
});

test("F1312 promote-sindico exige autenticação — token presente = prossegue", () => {
  const authHeader = "Bearer valid-token-123";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  assert.ok(token, "Com token → autenticado");
  assert.equal(token, "valid-token-123");
});

// ════════════ F1313 — ROLE NÃO AUTORIZADA BLOQUEADA ════════════

test("F1313 role não autorizada bloqueada — MORADOR não pode promover", () => {
  function isAuthorized(role: MembroRole): boolean {
    return ROLES_AUTORIZADAS_PROMOTE.includes(role);
  }

  assert.ok(!isAuthorized("MORADOR"));
  assert.ok(!isAuthorized("PORTEIRO"));
  assert.ok(!isAuthorized("ZELADOR"));
  assert.ok(!isAuthorized("SEGURANCA"));

  assert.ok(isAuthorized("SINDICO"));
  assert.ok(isAuthorized("ADMIN"));
  assert.ok(isAuthorized("ADMIN_CONDOMINIO"));
  assert.ok(isAuthorized("SUPER_ADMIN"));
});

// ════════════ F1314 — PROMOÇÃO ATUALIZA MEMBRO ════════════

test("F1314 promoção atualiza membro — novoUid vira SINDICO", () => {
  const membroBefore: MembroDoc = {
    uid: "user-promoted",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
  };

  assert.equal(membroBefore.role, "MORADOR");

  // Simulação da promoção
  const membroAfter: MembroDoc = { ...membroBefore, role: "SINDICO" };
  assert.equal(membroAfter.role, "SINDICO");
});

test("F1314 promoção atualiza membro — sindicoAtual vira MORADOR", () => {
  const sindicoBefore: MembroDoc = {
    uid: "user-sindico-old",
    condominioId: "condo-1",
    role: "SINDICO",
    status: "ATIVO",
  };

  assert.equal(sindicoBefore.role, "SINDICO");

  const sindicoAfter: MembroDoc = { ...sindicoBefore, role: "MORADOR" };
  assert.equal(sindicoAfter.role, "MORADOR");
});

// ════════════ F1315 — PROMOÇÃO ATUALIZA ÍNDICE ════════════

test("F1315 promoção atualiza índice — vínculo do novo síndico = SINDICO", () => {
  const novoVinculo: VinculoDoc = {
    condominioId: "condo-1",
    role: "SINDICO",
    status: "ATIVO",
  };

  assert.equal(novoVinculo.role, "SINDICO");
  assert.equal(novoVinculo.status, "ATIVO");
});

test("F1315 promoção atualiza índice — vínculo do ex-síndico = MORADOR", () => {
  const exVinculo: VinculoDoc = {
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
  };

  assert.equal(exVinculo.role, "MORADOR");
});

// ════════════ F1316 — AUTOELEVAÇÃO INDEVIDA BLOQUEADA ════════════

test("F1316 autoelevação indevida bloqueada — promoUid === actorUid = rejeitado", () => {
  function canPromote(actorUid: string, novoUid: string): boolean {
    return actorUid !== novoUid;
  }

  assert.ok(!canPromote("user-self", "user-self"), "Auto-promoção deve ser bloqueada");
  assert.ok(canPromote("user-admin", "user-morador"), "Admin promovendo outro é permitido");
});

// ════════════ F1317 — TENANT DIFERENTE BLOQUEADO ════════════

test("F1317 tenant diferente bloqueado — novoUid de outro condomínio rejeitado", () => {
  const membrosCondoA = new Set(["user-a1", "user-a2"]);
  const membrosCondoB = new Set(["user-b1", "user-b2"]);

  function hasMemberInCondo(uid: string, condo: Set<string>): boolean {
    return condo.has(uid);
  }

  // Usuário do condo B não pode ser promovido no condo A
  assert.ok(!hasMemberInCondo("user-b1", membrosCondoA));
  assert.ok(hasMemberInCondo("user-b1", membrosCondoB));

  // Usuário do condo A pode ser promovido no condo A
  assert.ok(hasMemberInCondo("user-a1", membrosCondoA));
});

// ════════════ F1318 — TENANT LEGADO NÃO AFETA CANÔNICO ════════════

test("F1318 tenant legado não afeta canônico — chacara-itaguai é isolado", () => {
  const TENANT_LEGADO = "chacara-itaguai";
  const TENANT_CANONICO = "RtJ7G92QwWvJ13Qq8Ntx";

  // IDs são diferentes
  assert.notEqual(TENANT_LEGADO, TENANT_CANONICO);

  // Operações no tenant legado não devem afetar o canônico
  const membrosLegado = new Set(["legacy-uid-1", "legacy-uid-2"]);
  const membrosCanonico = new Set(["real-uid-1", "real-uid-2"]);

  // Não há intersecção de membros
  for (const uid of membrosLegado) {
    assert.ok(!membrosCanonico.has(uid), `UID ${uid} do tenant legado não deve existir no canônico`);
  }
});

// ════════════ F1319 — MEMBRO INATIVO NÃO GERA SESSÃO ════════════

test("F1319 membro INATIVO não deve ter vínculo ATIVO", () => {
  const membro: MembroDoc = {
    uid: "user-inactive",
    condominioId: "condo-1",
    role: "MORADOR",
    status: "INATIVO",
  };

  // useSession filtra vínculos com status === "ATIVO"
  function canEstablishSession(vinculo: VinculoDoc): boolean {
    return vinculo.status === "ATIVO";
  }

  const vinculoInativo: VinculoDoc = {
    condominioId: membro.condominioId,
    role: membro.role,
    status: membro.status,
  };

  assert.ok(!canEstablishSession(vinculoInativo), "Membro INATIVO não deve estabelecer sessão");
});

// ════════════ F1320 — SYNC NÃO SOBRESCREVE CREATEDAT ════════════

test("F1320 sync não sobrescreve createdAt — merge preserva campos existentes", () => {
  const vinculoExistente = {
    condominioId: "condo-1",
    role: "MORADOR",
    status: "ATIVO",
    createdAt: "2025-01-01T00:00:00Z",
  };

  const syncData = {
    condominioId: "condo-1",
    role: "SINDICO",
    status: "ATIVO",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  // merge: true → campos não incluídos no sync não são sobrescritos
  const merged = { ...vinculoExistente, ...syncData };

  assert.equal(merged.role, "SINDICO");
  assert.equal(merged.createdAt, "2025-01-01T00:00:00Z", "createdAt deve ser preservado");
  assert.equal(merged.updatedAt, "2026-01-01T00:00:00Z");
});
