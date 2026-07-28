/**
 * FASE D.6 — SUÍTE DO DECISION DISPATCHER + FEATURE FLAGS.
 *
 * Cobre:
 *   - decisão do motor ativo via Feature Flag (defaults D.6, env, overrides);
 *   - alternância de flag em runtime;
 *   - dispatcher em LEGACY / SHADOW / POLICY / DISABLED;
 *   - APPROVE em POLICY (Policy Engine decide de ponta a ponta);
 *   - rollback automático (forceLegacy) por exceção e por timeout;
 *   - garantia de que o dispatcher NUNCA lança;
 *   - demais ações continuam em SHADOW por default;
 *   - telemetria em memória.
 *
 * Execução: npm run test:policy-engine  (node:test via tsx — sem framework novo)
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  getEngineMode,
  getPolicyTimeoutMs,
  setEngineModeOverride,
  setGlobalEngineModeOverride,
  clearEngineModeOverrides,
} from "../featureFlags";
import {
  dispatchReservaDecision,
  forceLegacy,
  getDispatcherTelemetry,
  resetDispatcherTelemetry,
  __setDispatcherDepsForTests,
  __resetDispatcherDepsForTests,
} from "../dispatcher";
import { motorDecision } from "../shadow/shadowRunner";
import type { ReservaAction } from "../types";

// ── Fake Firestore (somente leitura, espelha os paths do adapter admin) ─────

function makeSnap(data: Record<string, unknown> | undefined) {
  return {
    exists: data !== undefined,
    data: () => data ?? {},
  };
}

/** db falso navegável por path: "condominios/cond1/membros/uid-op" → doc. */
function fakeDb(docs: Record<string, Record<string, unknown>>): any {
  function docRef(path: string): any {
    return {
      collection: (name: string) => colRef(`${path}/${name}`),
      get: async () => makeSnap(docs[path]),
    };
  }
  function colRef(path: string): any {
    return {
      doc: (id: string) => {
        if (!id) {
          // Paridade com o Admin SDK real: doc("") lança.
          throw new Error("Value for argument \"documentPath\" is not a valid resource path. Path must be a non-empty string.");
        }
        return docRef(`${path}/${id}`);
      },
    };
  }
  return { collection: (name: string) => colRef(name) };
}

/** db falso que lança em qualquer leitura (Policy indisponível). */
function brokenDb(): any {
  return {
    collection: () => {
      throw new Error("FIRESTORE_UNAVAILABLE");
    },
  };
}

const COND = "RtJ7G92QwWvJ13Qq8Ntx";
const AREA = "salao_festas";
const OPERADOR = "uid-operador";
const FUTURE = "2026-07-20";

function baseDocs(memberStatus = "ATIVO"): Record<string, Record<string, unknown>> {
  return {
    [`condominios/${COND}/areasReservaveis/${AREA}`]: { ativo: true, nome: "Salão" },
    [`condominios/${COND}/membros/${OPERADOR}`]: { status: memberStatus, role: "SINDICO" },
  };
}

function approveCtx(over: Partial<Record<string, unknown>> = {}) {
  return {
    condominioId: COND,
    areaId: AREA,
    opcaoId: "base",
    dateStr: FUTURE,
    uid: OPERADOR,
    actorUid: OPERADOR,
    actorIsSuperAdmin: false,
    actorRole: "SINDICO",
    priceCentavos: 0,
    isOperatorAction: true,
    ...over,
  } as any;
}

beforeEach(() => {
  clearEngineModeOverrides();
  resetDispatcherTelemetry();
  __resetDispatcherDepsForTests();
});

afterEach(() => {
  clearEngineModeOverrides();
  __resetDispatcherDepsForTests();
  delete process.env.POLICY_ENGINE_MODE;
  delete process.env.POLICY_ENGINE_MODE_APPROVE;
  delete process.env.POLICY_ENGINE_MODE_CREATE;
  delete process.env.POLICY_ENGINE_POLICY_TIMEOUT_MS;
});

// ═══════════════════════════════════════════ FEATURE FLAGS ══════════════════

test("FF01 flags — default D.6: APPROVE ⇒ POLICY (primeira ativação)", () => {
  assert.equal(getEngineMode("APPROVE"), "POLICY");
});

test("FF02 flags — D.12.1: CREATE em POLICY; QUEUE_JOIN/CANCEL em SHADOW; OFFER_*/QUEUE_PROMOTE/APPROVE em POLICY", () => {
  assert.equal(getEngineMode("CREATE"), "POLICY");
  assert.equal(getEngineMode("OFFER_REJECT"), "POLICY");
  assert.equal(getEngineMode("OFFER_ACCEPT"), "POLICY");
  assert.equal(getEngineMode("QUEUE_PROMOTE"), "POLICY");
  assert.equal(getEngineMode("QUEUE_JOIN"), "POLICY");
  assert.equal(getEngineMode("CANCEL"), "POLICY");
});

test("FF03 flags — env por ação faz rollback instantâneo (POLICY_ENGINE_MODE_APPROVE=SHADOW)", () => {
  process.env.POLICY_ENGINE_MODE_APPROVE = "SHADOW";
  assert.equal(getEngineMode("APPROVE"), "SHADOW");
});

test("FF04 flags — env global vale para todas as ações; env por ação vence global", () => {
  process.env.POLICY_ENGINE_MODE = "LEGACY";
  assert.equal(getEngineMode("APPROVE"), "LEGACY");
  assert.equal(getEngineMode("CREATE"), "LEGACY");
  process.env.POLICY_ENGINE_MODE_CREATE = "DISABLED";
  assert.equal(getEngineMode("CREATE"), "DISABLED");
});

test("FF05 flags — override runtime por ação vence env e default", () => {
  process.env.POLICY_ENGINE_MODE_APPROVE = "LEGACY";
  setEngineModeOverride("APPROVE", "DISABLED");
  assert.equal(getEngineMode("APPROVE"), "DISABLED");
  setEngineModeOverride("APPROVE", null);
  assert.equal(getEngineMode("APPROVE"), "LEGACY");
});

test("FF06 flags — override runtime global; por ação continua vencendo", () => {
  setGlobalEngineModeOverride("LEGACY");
  assert.equal(getEngineMode("CREATE"), "LEGACY");
  assert.equal(getEngineMode("APPROVE"), "LEGACY");
  setEngineModeOverride("APPROVE", "POLICY");
  assert.equal(getEngineMode("APPROVE"), "POLICY");
});

test("FF07 flags — valor inválido de env é ignorado ⇒ default da fase", () => {
  process.env.POLICY_ENGINE_MODE_APPROVE = "TURBO";
  assert.equal(getEngineMode("APPROVE"), "POLICY");
});

test("FF08 flags — clearEngineModeOverrides restaura defaults D.12.1", () => {
  setGlobalEngineModeOverride("DISABLED");
  setEngineModeOverride("APPROVE", "LEGACY");
  clearEngineModeOverrides();
  assert.equal(getEngineMode("APPROVE"), "POLICY");
  assert.equal(getEngineMode("CREATE"), "POLICY");
});

test("FF09 flags — timeout: default 4000ms (calibrado na homologação runtime); configurável por env", () => {
  assert.equal(getPolicyTimeoutMs(), 4000);
  process.env.POLICY_ENGINE_POLICY_TIMEOUT_MS = "250";
  assert.equal(getPolicyTimeoutMs(), 250);
  process.env.POLICY_ENGINE_POLICY_TIMEOUT_MS = "abc";
  assert.equal(getPolicyTimeoutMs(), 4000);
});

// ═══════════════════════════════════════════ DISPATCHER — POLICY ════════════

test("DP01 dispatcher — APPROVE em POLICY: membro ativo ⇒ Policy decide PERMITIDO", async () => {
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs("ATIVO")),
    motorDecision({ action: "APPROVE", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.mode, "POLICY");
  assert.equal(outcome.allowed, true);
  assert.equal(outcome.rolledBack, false);
  assert.ok(outcome.policyResult);
  assert.equal(getDispatcherTelemetry().POLICY, 1);
  assert.equal(getDispatcherTelemetry().ROLLBACKS, 0);
});

test("DP02 dispatcher — APPROVE em POLICY: membro inativo ⇒ Policy decide BLOQUEADO (MEMBRO_INATIVO)", async () => {
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs("INATIVO")),
    motorDecision({
      action: "APPROVE", allowed: false,
      blockRule: "MEMBRO_INATIVO", blockPriority: "BLOCKER",
      blockMessage: "Membro inativo.", blockOrigin: "CONDOMINIO",
    }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.allowed, false);
  assert.equal(outcome.blockMessage, "Membro inativo.");
  assert.ok(outcome.policyResult);
  assert.deepEqual(outcome.policyResult!.violations.map((v) => v.code), ["MEMBRO_INATIVO"]);
});

test("DP03 dispatcher — APPROVE em POLICY: super admin ⇒ PERMITIDO (paridade homologada)", async () => {
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs("INATIVO")),
    motorDecision({ action: "APPROVE", allowed: true }),
    approveCtx({ actorIsSuperAdmin: true }),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.allowed, true);
});

// ═══════════════════════════════════ DISPATCHER — ROLLBACK AUTOMÁTICO ═══════

test("DP04 dispatcher — rollback automático por EXCEÇÃO ⇒ forceLegacy preserva decisão legada", async () => {
  const outcome = await dispatchReservaDecision(
    brokenDb(),
    motorDecision({ action: "APPROVE", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "LEGACY");
  assert.equal(outcome.mode, "POLICY");
  assert.equal(outcome.allowed, true); // decisão legada, nunca erro ao usuário
  assert.equal(outcome.rolledBack, true);
  assert.equal(outcome.policyResult, null);
  const t = getDispatcherTelemetry();
  assert.equal(t.ROLLBACKS, 1);
  assert.equal(t.LEGACY, 1);
  assert.equal(t.POLICY, 0);
});

test("DP05 dispatcher — rollback automático por TIMEOUT ⇒ forceLegacy", async () => {
  process.env.POLICY_ENGINE_POLICY_TIMEOUT_MS = "25";
  __setDispatcherDepsForTests({
    evaluatePolicy: () => new Promise(() => {}), // Policy Engine pendurado
  });
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs()),
    motorDecision({ action: "APPROVE", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.rolledBack, true);
  assert.equal(outcome.engine, "LEGACY");
  assert.equal(outcome.allowed, true);
  assert.equal(getDispatcherTelemetry().ROLLBACKS, 1);
});

test("DP06 dispatcher — rollback preserva decisão legada de BLOQUEIO (caminho membro inativo do aprovar)", async () => {
  // aprovar/route.ts (bloqueio) despacha com areaId="" ⇒ Admin SDK lança ⇒ rollback.
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs()),
    motorDecision({
      action: "APPROVE", allowed: false,
      blockRule: "MEMBRO_INATIVO", blockPriority: "BLOCKER",
      blockMessage: "Membro inativo.", blockOrigin: "CONDOMINIO",
    }),
    approveCtx({ areaId: "", dateStr: "" }),
  );
  assert.equal(outcome.rolledBack, true);
  assert.equal(outcome.engine, "LEGACY");
  assert.equal(outcome.allowed, false); // 403 legado preservado
  assert.equal(outcome.blockMessage, "Membro inativo.");
});

test("DP07 dispatcher — NUNCA lança para o chamador, mesmo com tudo quebrado", async () => {
  __setDispatcherDepsForTests({
    evaluatePolicy: () => {
      throw new Error("boom síncrono");
    },
  });
  await assert.doesNotReject(async () => {
    const outcome = await dispatchReservaDecision(
      brokenDb(),
      motorDecision({ action: "APPROVE", allowed: true }),
    approveCtx({ areaAtivo: false }),
    );
    assert.equal(outcome.engine, "LEGACY");
    assert.equal(outcome.allowed, true);
  });
});

// ═══════════════════════════════ DISPATCHER — SHADOW / LEGACY / DISABLED ════

test("DP08 dispatcher — SHADOW: legado decide; shadowEvaluate é invocado fire-and-forget", async () => {
  let shadowCalls = 0;
  __setDispatcherDepsForTests({
    shadow: async () => {
      shadowCalls += 1;
    },
  });
  setEngineModeOverride("APPROVE", "SHADOW");
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs()),
    motorDecision({ action: "APPROVE", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "LEGACY");
  assert.equal(outcome.mode, "SHADOW");
  assert.equal(outcome.allowed, true);
  assert.equal(shadowCalls, 1);
  assert.equal(getDispatcherTelemetry().SHADOW, 1);
});

test("DP09 dispatcher — CREATE agora em POLICY por default (D.12.1)", async () => {
  let policyEvals = 0;
  __setDispatcherDepsForTests({
    evaluatePolicy: async (...args: any[]) => {
      policyEvals += 1;
      const { validate } = await import("../validator");
      const { compileSnapshot, legacySnapshot, makeContext } = await import("../index");
      const TARGET = { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas" };
      const NOW = new Date();
      const snap = legacySnapshot(TARGET, NOW);
      const compiled = compileSnapshot(snap, NOW);
      const ctx = makeContext({ now: NOW, dateStr: "2026-07-20", target: TARGET, actor: { uid:"u",exists:true,status:"ATIVO",role:"MORADOR",blocoIdNorm:null, unidadeIdNorm:null, isSuperAdmin:false,isPaidUp:null,recentNoShows:0,suspendedUntil:null } });
      return validate("CREATE", compiled, ctx);
    },
  });
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs()),
    motorDecision({ action: "CREATE", allowed: true, mode: "RESERVA" }),
    approveCtx(),
  );
  assert.equal(outcome.mode, "POLICY");
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.allowed, true);
  assert.ok(policyEvals >= 1);
});

test("DP10 dispatcher — LEGACY: legado decide; Policy NÃO avalia; apenas observa", async () => {
  let evals = 0;
  let shadowCalls = 0;
  __setDispatcherDepsForTests({
    evaluatePolicy: async () => {
      evals += 1;
      throw new Error("não deveria avaliar");
    },
    shadow: async () => {
      shadowCalls += 1;
    },
  });
  setEngineModeOverride("APPROVE", "LEGACY");
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs()),
    motorDecision({ action: "APPROVE", allowed: false, blockMessage: "Membro inativo." }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "LEGACY");
  assert.equal(outcome.allowed, false);
  assert.equal(evals, 0);
  assert.equal(shadowCalls, 0);
  assert.equal(getDispatcherTelemetry().LEGACY, 1);
});

test("DP11 dispatcher — DISABLED: engine desligado; sem shadow; sem avaliação; legado decide", async () => {
  let evals = 0;
  let shadowCalls = 0;
  __setDispatcherDepsForTests({
    evaluatePolicy: async () => {
      evals += 1;
      throw new Error("não deveria avaliar");
    },
    shadow: async () => {
      shadowCalls += 1;
    },
  });
  setEngineModeOverride("APPROVE", "DISABLED");
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs()),
    motorDecision({ action: "APPROVE", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "LEGACY");
  assert.equal(outcome.mode, "DISABLED");
  assert.equal(outcome.allowed, true);
  assert.equal(evals, 0);
  assert.equal(shadowCalls, 0);
});

// ═══════════════════════════════════ ALTERNÂNCIA DE FLAG EM RUNTIME ═════════

test("DP12 dispatcher — alternância POLICY → SHADOW → POLICY muda o motor decisor imediatamente", async () => {
  const db = fakeDb(baseDocs());
  const motor = () => motorDecision({ action: "APPROVE", allowed: true });

  const a = await dispatchReservaDecision(db, motor(), approveCtx());
  assert.equal(a.engine, "POLICY");

  setEngineModeOverride("APPROVE", "SHADOW"); // rollback instantâneo
  const b = await dispatchReservaDecision(db, motor(), approveCtx());
  assert.equal(b.engine, "LEGACY");
  assert.equal(b.mode, "SHADOW");

  setEngineModeOverride("APPROVE", null); // reativação
  const c = await dispatchReservaDecision(db, motor(), approveCtx());
  assert.equal(c.engine, "POLICY");
});

// ═══════════════════════════════════════════ TELEMETRIA / forceLegacy ═══════

test("DP13 telemetria — contadores acumulam por modo e reset zera", async () => {
  const db = fakeDb(baseDocs());
  await dispatchReservaDecision(db, motorDecision({ action: "APPROVE", allowed: true }), approveCtx());
  setEngineModeOverride("APPROVE", "SHADOW");
  await dispatchReservaDecision(db, motorDecision({ action: "APPROVE", allowed: true }), approveCtx());
  setEngineModeOverride("APPROVE", "LEGACY");
  await dispatchReservaDecision(db, motorDecision({ action: "APPROVE", allowed: true }), approveCtx());
  setEngineModeOverride("APPROVE", "POLICY");
  await dispatchReservaDecision(brokenDb(), motorDecision({ action: "APPROVE", allowed: true }), approveCtx());

  const t = getDispatcherTelemetry();
  assert.equal(t.POLICY, 1);
  assert.equal(t.SHADOW, 1);
  assert.equal(t.LEGACY, 2); // 1 modo LEGACY + 1 rollback
  assert.equal(t.ROLLBACKS, 1);

  resetDispatcherTelemetry();
  assert.deepEqual(getDispatcherTelemetry(), { LEGACY: 0, POLICY: 0, SHADOW: 0, ROLLBACKS: 0, byAction: {} });
});

test("DP14 forceLegacy — devolve a decisão legada intacta e conta rollback", () => {
  const motor = motorDecision({
    action: "APPROVE", allowed: false,
    blockRule: "MEMBRO_INATIVO", blockPriority: "BLOCKER",
    blockMessage: "Membro inativo.", blockOrigin: "CONDOMINIO",
  });
  const outcome = forceLegacy(motor, "POLICY", "teste unitário");
  assert.equal(outcome.engine, "LEGACY");
  assert.equal(outcome.allowed, false);
  assert.equal(outcome.rolledBack, true);
  assert.equal(outcome.blockMessage, "Membro inativo.");
  assert.equal(getDispatcherTelemetry().ROLLBACKS, 1);
});

// ═══════════════════════════════════════════ D.7 — FLAGS EXPANDIDAS ════════

test("FF10 flags D.7 — default: OFFER_REJECT ⇒ POLICY", () => {
  assert.equal(getEngineMode("OFFER_REJECT"), "POLICY");
});

test("FF11 flags D.7 — default: OFFER_ACCEPT ⇒ POLICY", () => {
  assert.equal(getEngineMode("OFFER_ACCEPT"), "POLICY");
});

test("FF12 flags D.7 — default: QUEUE_PROMOTE ⇒ POLICY", () => {
  assert.equal(getEngineMode("QUEUE_PROMOTE"), "POLICY");
});

test("FF13 flags D.12.1 — QUEUE_JOIN, CANCEL continuam em SHADOW; CREATE em POLICY", () => {
  assert.equal(getEngineMode("CREATE"), "POLICY");
  assert.equal(getEngineMode("QUEUE_JOIN"), "POLICY");
  assert.equal(getEngineMode("CANCEL"), "POLICY");
});

test("FF14 flags D.7 — rollback global de emergência (setGlobalEngineModeOverride)", () => {
  setGlobalEngineModeOverride("SHADOW");
  assert.equal(getEngineMode("APPROVE"), "SHADOW");
  assert.equal(getEngineMode("OFFER_ACCEPT"), "SHADOW");
  assert.equal(getEngineMode("QUEUE_PROMOTE"), "SHADOW");
  setGlobalEngineModeOverride(null);
  assert.equal(getEngineMode("APPROVE"), "POLICY");
});

test("FF15 flags D.7 — rollback individual por ação sem afetar as demais", () => {
  setEngineModeOverride("OFFER_ACCEPT", "SHADOW");
  assert.equal(getEngineMode("OFFER_ACCEPT"), "SHADOW");
  assert.equal(getEngineMode("OFFER_REJECT"), "POLICY");
  assert.equal(getEngineMode("QUEUE_PROMOTE"), "POLICY");
  setEngineModeOverride("OFFER_ACCEPT", null);
});

// ═════════════════════ DISPATCHER — D.7 NOVAS AÇÕES EM POLICY ═══════════════

test("DP15 dispatcher — OFFER_ACCEPT em POLICY: membro ativo ⇒ Policy decide PERMITIDO", async () => {
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs("ATIVO")),
    motorDecision({ action: "OFFER_ACCEPT", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.mode, "POLICY");
  assert.equal(outcome.allowed, true);
  assert.equal(outcome.rolledBack, false);
  assert.ok(outcome.policyResult);
  assert.equal(getDispatcherTelemetry().POLICY, 1);
});

test("DP16 dispatcher — OFFER_ACCEPT em POLICY: área inativa ⇒ Policy bloqueia (AREA_INATIVA)", async () => {
  const docs = baseDocs("ATIVO");
  docs[`condominios/${COND}/areasReservaveis/${AREA}`] = { ativo: false, nome: "Salão" };
  const outcome = await dispatchReservaDecision(
    fakeDb(docs),
    motorDecision({
      action: "OFFER_ACCEPT", allowed: false,
      blockRule: "AREA_INATIVA", blockPriority: "BLOCKER",
      blockMessage: "Área desativada.", blockOrigin: "AREA",
    }),
    approveCtx({ areaAtivo: false }),
  );
  const t = getDispatcherTelemetry();
  assert.equal(t.POLICY, 1);
  assert.equal(t.byAction["OFFER_ACCEPT"] ?? 0, 1);
});

test("DP17 dispatcher — OFFER_ACCEPT em POLICY: bloco não permitido ⇒ bloqueia (BLOCO_NAO_PERMITIDO)", async () => {
  const docs = baseDocs("ATIVO");
  docs[`condominios/${COND}/areasReservaveis/${AREA}`] = {
    ativo: true, nome: "Salão", escopoReserva: "BLOCO",
    blocosPermitidos: ["laranjeiras"],
  };
  const outcome = await dispatchReservaDecision(
    fakeDb(docs),
    motorDecision({
      action: "OFFER_ACCEPT", allowed: false,
      blockRule: "BLOCO_NAO_PERMITIDO", blockPriority: "BLOCKER",
      blockMessage: "Bloco não permitido.", blockOrigin: "AREA",
    }),
    approveCtx({ memberFactsOverride: { blocoIdNorm: "rosas" } }),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.allowed, false);
  assert.deepEqual(outcome.policyResult!.violations.map((v) => v.code), ["BLOCO_NAO_PERMITIDO"]);
});

test("DP18 dispatcher — OFFER_REJECT em POLICY: membro ativo ⇒ PERMITIDO", async () => {
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs("ATIVO")),
    motorDecision({ action: "OFFER_REJECT", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.allowed, true);
  assert.ok(outcome.policyResult);
});

test("DP19 dispatcher — OFFER_REJECT em POLICY: membro inativo ⇒ bloqueia (MEMBRO_INATIVO)", async () => {
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs("INATIVO")),
    motorDecision({
      action: "OFFER_REJECT", allowed: false,
      blockRule: "MEMBRO_INATIVO", blockPriority: "BLOCKER",
      blockMessage: "Membro inativo.", blockOrigin: "CONDOMINIO",
    }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.allowed, false);
  assert.equal(outcome.blockMessage, "Membro inativo.");
});

test("DP20 dispatcher — QUEUE_PROMOTE em POLICY: membro ativo ⇒ PERMITIDO", async () => {
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs("ATIVO")),
    motorDecision({ action: "QUEUE_PROMOTE", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.allowed, true);
  assert.ok(outcome.policyResult);
});

test("DP21 dispatcher — QUEUE_PROMOTE em POLICY: data passada ⇒ bloqueia (DATA_PASSADA)", async () => {
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs("ATIVO")),
    motorDecision({
      action: "QUEUE_PROMOTE", allowed: false,
      blockRule: "DATA_PASSADA", blockPriority: "BLOCKER",
      blockMessage: "Data passada.", blockOrigin: "DEFAULT",
    }),
    approveCtx({ dateStr: "2026-07-01" }),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.allowed, false);
  assert.deepEqual(outcome.policyResult!.violations.map((v) => v.code), ["DATA_PASSADA"]);
});

test("DP22 dispatcher — QUEUE_PROMOTE em POLICY: domingo ⇒ bloqueia (DIA_SEMANA_BLOQUEADO)", async () => {
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs("ATIVO")),
    motorDecision({
      action: "QUEUE_PROMOTE", allowed: false,
      blockRule: "DIA_SEMANA_BLOQUEADO", blockPriority: "VALIDATION",
      blockMessage: "Domingo.", blockOrigin: "DEFAULT",
    }),
    approveCtx({ dateStr: "2026-07-19" }),
  );
  assert.equal(outcome.engine, "POLICY");
  assert.equal(outcome.allowed, false);
  assert.ok(outcome.policyResult!.violations.map((v) => v.code).includes("DIA_SEMANA_BLOQUEADO"));
});

// ═══════════════════════ TELEMETRIA D.7 — CONTADORES POR AÇÃO ═══════════════

test("DP23 telemetria D.7 — contagem por ação (byAction)", async () => {
  const db = fakeDb(baseDocs());
  await dispatchReservaDecision(db, motorDecision({ action: "APPROVE", allowed: true }), approveCtx());
  await dispatchReservaDecision(db, motorDecision({ action: "OFFER_ACCEPT", allowed: true }), approveCtx());
  await dispatchReservaDecision(db, motorDecision({ action: "OFFER_REJECT", allowed: true }), approveCtx());
  await dispatchReservaDecision(db, motorDecision({ action: "QUEUE_PROMOTE", allowed: true }), approveCtx());

  const t = getDispatcherTelemetry();
  assert.equal(t.byAction["APPROVE"] ?? 0, 1);
  assert.equal(t.byAction["OFFER_ACCEPT"] ?? 0, 1);
  assert.equal(t.byAction["OFFER_REJECT"] ?? 0, 1);
  assert.equal(t.byAction["QUEUE_PROMOTE"] ?? 0, 1);
  assert.equal(t.POLICY, 4);
});

test("DP24 telemetria D.7 — reset zera both mode counters and byAction", async () => {
  const db = fakeDb(baseDocs());
  await dispatchReservaDecision(db, motorDecision({ action: "OFFER_ACCEPT", allowed: true }), approveCtx());
  assert.equal(getDispatcherTelemetry().byAction["OFFER_ACCEPT"] ?? 0, 1);
  resetDispatcherTelemetry();
  const t = getDispatcherTelemetry();
  assert.equal(t.POLICY, 0);
  assert.equal(t.byAction["OFFER_ACCEPT"] ?? 0, 0);
});

// ══════════════════════════ DISPATCHER — CRITÉRIO DE PARADA ═════════════════

test("DP25 critério de parada D.12.1 — CREATE migrou para POLICY", async () => {
  let policyEvals = 0;
  __setDispatcherDepsForTests({
    evaluatePolicy: async (...args: any[]) => {
      policyEvals += 1;
      const { validate } = await import("../validator");
      const { compileSnapshot, legacySnapshot, makeContext } = await import("../index");
      const TARGET = { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas" };
      const snap = legacySnapshot(TARGET, new Date());
      return validate("CREATE", compileSnapshot(snap, new Date()), makeContext({ dateStr: "2026-07-20", target: TARGET, actor: { uid:"u",exists:true,status:"ATIVO",role:"MORADOR",blocoIdNorm:null, unidadeIdNorm:null, isSuperAdmin:false,isPaidUp:null,recentNoShows:0,suspendedUntil:null } }));
    },
  });
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs()),
    motorDecision({ action: "CREATE", allowed: true, mode: "RESERVA" }),
    approveCtx(),
  );
  assert.equal(outcome.mode, "POLICY");
  assert.equal(outcome.engine, "POLICY");
});

test("DP26 critério de parada D.12.3 — CANCEL migrou para POLICY", async () => {
  let policyEvals = 0;
  __setDispatcherDepsForTests({
    evaluatePolicy: async (...args: any[]) => {
      policyEvals += 1;
      const { validate } = await import("../validator");
      const { compileSnapshot, legacySnapshot, makeContext } = await import("../index");
      const TARGET = { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas" };
      const snap = legacySnapshot(TARGET, new Date());
      return validate("CANCEL", compileSnapshot(snap, new Date()), makeContext({ dateStr: "2026-07-20", target: TARGET, actor: { uid:"u",exists:true,status:"ATIVO",role:"MORADOR",blocoIdNorm:null, unidadeIdNorm:null, isSuperAdmin:false,isPaidUp:null,recentNoShows:0,suspendedUntil:null }, reserva: { eventMs: Date.UTC(2026,6,20,12), status: "APROVADA", valorCobradoCentavos: 0 } }));
    },
  });
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs()),
    motorDecision({ action: "CANCEL", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.mode, "POLICY");
  assert.equal(outcome.engine, "POLICY");
});

test("DP27 critério de parada D.12.2 — QUEUE_JOIN migrou para POLICY", async () => {
  let policyEvals = 0;
  __setDispatcherDepsForTests({
    evaluatePolicy: async (...args: any[]) => {
      policyEvals += 1;
      const { validate } = await import("../validator");
      const { compileSnapshot, legacySnapshot, makeContext } = await import("../index");
      const TARGET = { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas" };
      const snap = legacySnapshot(TARGET, new Date());
      return validate("QUEUE_JOIN", compileSnapshot(snap, new Date()), makeContext({ dateStr: "2026-07-20", target: TARGET, actor: { uid:"u",exists:true,status:"ATIVO",role:"MORADOR",blocoIdNorm:null, unidadeIdNorm:null, isSuperAdmin:false,isPaidUp:null,recentNoShows:0,suspendedUntil:null } }));
    },
  });
  const outcome = await dispatchReservaDecision(
    fakeDb(baseDocs()),
    motorDecision({ action: "QUEUE_JOIN", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.mode, "POLICY");
  assert.equal(outcome.engine, "POLICY");
});

test("DP28 troca dinâmica — OFFER_ACCEPT pode ir e voltar via override individual", async () => {
  const db = fakeDb(baseDocs());
  const m = () => motorDecision({ action: "OFFER_ACCEPT", allowed: true });
  const a = await dispatchReservaDecision(db, m(), approveCtx());
  assert.equal(a.engine, "POLICY");
  setEngineModeOverride("OFFER_ACCEPT", "SHADOW");
  const b = await dispatchReservaDecision(db, m(), approveCtx());
  assert.equal(b.engine, "LEGACY");
  assert.equal(b.mode, "SHADOW");
  setEngineModeOverride("OFFER_ACCEPT", "LEGACY");
  const c = await dispatchReservaDecision(db, m(), approveCtx());
  assert.equal(c.mode, "LEGACY");
  setEngineModeOverride("OFFER_ACCEPT", null);
  const d = await dispatchReservaDecision(db, m(), approveCtx());
  assert.equal(d.engine, "POLICY");
});

test("DP29 rollback por exceção — QUEUE_PROMOTE com db quebrado ⇒ forceLegacy", async () => {
  const outcome = await dispatchReservaDecision(
    brokenDb(),
    motorDecision({ action: "QUEUE_PROMOTE", allowed: true }),
    approveCtx(),
  );
  assert.equal(outcome.rolledBack, true);
  assert.equal(outcome.engine, "LEGACY");
  assert.equal(outcome.allowed, true);
  assert.equal(getDispatcherTelemetry().ROLLBACKS, 1);
  assert.equal(getDispatcherTelemetry().byAction["QUEUE_PROMOTE"] ?? 0, 1);
});
