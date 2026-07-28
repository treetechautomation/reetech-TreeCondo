/**
 * FASE D.8.1 (P0 ARCH) — TESTES DE ISOLAMENTO ABSOLUTO ENTRE CONDOMÍNIOS.
 *
 * Cobre:
 *   - isolamento: novo condomínio NUNCA herda regras da Chácara;
 *   - cache isolado por condominioId;
 *   - snapshots com condominioId (hash independente);
 *   - LEGACY_POLICY_CHACARA_ITAGUAI vs DEFAULT_POLICY;
 *   - LEGACY_POLICY_REGISTRY — somente a Chácara recebe política legada;
 *   - RegulamentoService (contratos);
 *   - HerancaUtils (resolução de herança).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createCachedPolicyRepository,
  DEFAULT_POLICY,
  LEGACY_POLICY_CHACARA_ITAGUAI,
  LEGACY_POLICY_REGISTRY,
  getLegacyPolicyForCondominio,
  legacySnapshot,
  mergePolicyLayers,
  policyHash,
  resolvePolicy,
  type PartialPolicy,
  type PolicyRepository,
} from "../index";
import { buildSnapshot } from "../snapshots";
import { HerancaUtils } from "../regulamento";
import { LEGACY_POLICY_VERSION } from "../versioning";

const CHACARA_ID = "RtJ7G92QwWvJ13Qq8Ntx";

const NOW = new Date("2026-07-15T15:00:00.000Z");

// ════════════════════════════════ ISOLAMENTO ENTRE CONDOMÍNIOS ═══════════════

test("D801 isolamento — DEFAULT_POLICY NÃO contém regras da Chácara", () => {
  assert.deepEqual(DEFAULT_POLICY.weekdays.blockedWeekdays, []);
  assert.deepEqual(DEFAULT_POLICY.holidays.fixedDates, []);
  assert.equal(DEFAULT_POLICY.holidays.mode, "ALLOW");
  assert.equal(DEFAULT_POLICY.booking.autoApproveAfterHours, 0);
  assert.equal(DEFAULT_POLICY.cancellation.minHoursBeforeEvent, 0);
  assert.equal(DEFAULT_POLICY.quota.maxQueueSize, 0);
  assert.equal(DEFAULT_POLICY.queue.offerDurationMinutes, 0);
});

test("D802 isolamento — LEGACY_POLICY_CHACARA_ITAGUAI preserva regras da Chácara", () => {
  assert.deepEqual(LEGACY_POLICY_CHACARA_ITAGUAI.weekdays.blockedWeekdays, [0]);
  assert.deepEqual(LEGACY_POLICY_CHACARA_ITAGUAI.holidays.fixedDates, ["12-24", "12-25", "12-31", "01-01"]);
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.holidays.mode, "BLOCK");
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.booking.autoApproveAfterHours, 24);
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.cancellation.minHoursBeforeEvent, 48);
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.quota.maxQueueSize, 3);
  assert.equal(LEGACY_POLICY_CHACARA_ITAGUAI.queue.offerDurationMinutes, 120);
});

test("D803 isolamento — hash da Chácara é diferente do DEFAULT_POLICY", () => {
  assert.notEqual(policyHash(LEGACY_POLICY_CHACARA_ITAGUAI), policyHash(DEFAULT_POLICY));
});

test("D804 isolamento — resolver do condomínio A vs B usa políticas diferentes; novo condomínio NUNCA herda Chácara", async () => {
  // Condomínio registrado (Chácara): recebe LEGACY_POLICY_CHACARA_ITAGUAI
  const repoChacara: PolicyRepository = {
    getPublishedVersion: async () => ({ version: 0, publishedAt: null }),
    getCondominioPolicy: async () => null,
    getAreaPolicy: async () => null,
    getOpcaoPolicy: async () => null,
    getMemberFacts: async (_, uid) => ({ uid, exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null, isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null }),
    getQuotaFacts: async () => ({ monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 0 }),
  };

  // Condomínio NOVO (não registrado): recebe DEFAULT_POLICY
  const repoNovo: PolicyRepository = {
    getPublishedVersion: async () => ({ version: 0, publishedAt: null }),
    getCondominioPolicy: async () => null,
    getAreaPolicy: async () => null,
    getOpcaoPolicy: async () => null,
    getMemberFacts: async (_, uid) => ({ uid, exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null, isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null }),
    getQuotaFacts: async () => ({ monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 0 }),
  };

  const rChacara = await resolvePolicy(repoChacara, { condominioId: CHACARA_ID, areaId: "area1" }, NOW);
  const rNovo = await resolvePolicy(repoNovo, { condominioId: "condNovoXYZ", areaId: "area1" }, NOW);

  // Chácara registrada → recebe LEGACY_POLICY_CHACARA_ITAGUAI
  assert.equal(rChacara.policy.quota.maxQueueSize, 3);
  assert.equal(rChacara.policy.weekdays.blockedWeekdays[0], 0);
  assert.equal(rChacara.provenance["quota.maxQueueSize"], "DEFAULT");

  // Condomínio novo → NUNCA herda regras da Chácara
  assert.equal(rNovo.policy.quota.maxQueueSize, 0);      // neutro
  assert.deepEqual(rNovo.policy.weekdays.blockedWeekdays, []); // sem domingo
  assert.deepEqual(rNovo.policy.holidays.fixedDates, []);     // sem feriados
  assert.equal(rNovo.policy.holidays.mode, "ALLOW");          // sem bloqueio
});

test("D805 isolamento — cache é indexado por condominioId; condomínios não compartilham entradas", async () => {
  let callsA = 0;
  let callsB = 0;

  const inner: PolicyRepository = {
    getPublishedVersion: async (cid) => ({ version: cid === "condA" ? 1 : 2, publishedAt: null }),
    getCondominioPolicy: async (cid) => {
      if (cid === "condA") { callsA++; return { quota: { maxQueueSize: 5 } } as PartialPolicy; }
      callsB++; return { quota: { maxQueueSize: 15 } } as PartialPolicy;
    },
    getAreaPolicy: async () => null,
    getOpcaoPolicy: async () => null,
    getMemberFacts: async (_, uid) => ({ uid, exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null, isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null }),
    getQuotaFacts: async () => ({ monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 0 }),
  };

  const repo = createCachedPolicyRepository(inner);

  // Primeira leitura de cada condomínio — popula o cache
  const p1a = await repo.getCondominioPolicy("condA");
  const p1b = await repo.getCondominioPolicy("condB");
  assert.equal(p1a?.quota?.maxQueueSize, 5);
  assert.equal(p1b?.quota?.maxQueueSize, 15);
  assert.equal(callsA, 1);
  assert.equal(callsB, 1);

  // Segunda leitura — VEM DO CACHE
  const p2a = await repo.getCondominioPolicy("condA");
  const p2b = await repo.getCondominioPolicy("condB");
  assert.equal(p2a?.quota?.maxQueueSize, 5);
  assert.equal(p2b?.quota?.maxQueueSize, 15);
  assert.equal(callsA, 1); // ainda 1 — cache hit
  assert.equal(callsB, 1); // ainda 1 — cache hit
});

test("D806 cache — mudança de versão invalida apenas o condomínio afetado", async () => {
  let versionA = 1;
  let callsA = 0;

  const inner: PolicyRepository = {
    getPublishedVersion: async (cid) => {
      if (cid === "condA") return { version: versionA, publishedAt: null };
      return { version: 5, publishedAt: null };
    },
    getCondominioPolicy: async (cid) => {
      if (cid === "condA") { callsA++; return { quota: { maxQueueSize: versionA * 10 } } as PartialPolicy; }
      return { quota: { maxQueueSize: 99 } } as PartialPolicy;
    },
    getAreaPolicy: async () => null,
    getOpcaoPolicy: async () => null,
    getMemberFacts: async (_, uid) => ({ uid, exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null, isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null }),
    getQuotaFacts: async () => ({ monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 0 }),
  };

  const repo = createCachedPolicyRepository(inner);

  const a1 = await repo.getCondominioPolicy("condA");
  assert.equal(a1?.quota?.maxQueueSize, 10);
  assert.equal(callsA, 1);

  // Versão muda → invalida cache de condA
  versionA = 2;
  const a2 = await repo.getCondominioPolicy("condA");
  assert.equal(a2?.quota?.maxQueueSize, 20);
  assert.equal(callsA, 2); // nova chamada

  // Versão não muda → cache hit
  const a3 = await repo.getCondominioPolicy("condA");
  assert.equal(a3?.quota?.maxQueueSize, 20);
  assert.equal(callsA, 2); // ainda 2

  // CondB não foi afetado pela invalidação de condA
  const b = await repo.getCondominioPolicy("condB");
  assert.equal(b?.quota?.maxQueueSize, 99);
});

// ═══════════════════════════════════════════ SNAPSHOTS ══════════════════════

test("D807 snapshots — buildSnapshot inclui condominioId; Chácara tem hash próprio", () => {
  const resolved = {
    policy: LEGACY_POLICY_CHACARA_ITAGUAI,
    version: 1,
    target: { condominioId: CHACARA_ID, areaId: "areaY" },
    provenance: {},
    resolvedAt: NOW.toISOString(),
  };
  const snapshot = buildSnapshot(resolved, NOW);
  assert.equal(snapshot.condominioId, CHACARA_ID);
  assert.equal(snapshot.policyHash, policyHash(LEGACY_POLICY_CHACARA_ITAGUAI));
});

test("D808 snapshots — reservas de condomínios diferentes preservam políticas e hashes independentes", () => {
  const snapshotChacara = buildSnapshot({
    policy: { ...LEGACY_POLICY_CHACARA_ITAGUAI, quota: { ...LEGACY_POLICY_CHACARA_ITAGUAI.quota, maxQueueSize: 10 } },
    version: 1,
    target: { condominioId: CHACARA_ID, areaId: "area1" },
    provenance: {},
    resolvedAt: NOW.toISOString(),
  }, NOW);

  const snapshotNovo = buildSnapshot({
    policy: { ...DEFAULT_POLICY, quota: { ...DEFAULT_POLICY.quota, maxQueueSize: 5 } },
    version: 1,
    target: { condominioId: "condNovoXYZ", areaId: "area1" },
    provenance: {},
    resolvedAt: NOW.toISOString(),
  }, NOW);

  assert.equal(snapshotChacara.condominioId, CHACARA_ID);
  assert.equal(snapshotChacara.policy.quota.maxQueueSize, 10);
  assert.equal(snapshotNovo.condominioId, "condNovoXYZ");
  assert.equal(snapshotNovo.policy.quota.maxQueueSize, 5);
  assert.notEqual(snapshotChacara.policyHash, snapshotNovo.policyHash);
  // Snapshot novo NÃO contém hash da Chácara
  assert.notEqual(snapshotNovo.policyHash, policyHash(LEGACY_POLICY_CHACARA_ITAGUAI));
});

// ═══════════════════════════════════════════ HERANÇA ════════════════════════

test("D809 herança — resolveHeranca aplica camadas na ordem correta", () => {
  const base = structuredClone(DEFAULT_POLICY);

  const resolved = HerancaUtils.resolveHeranca(base, [
    {
      target: { condominioId: "c1", areaId: "a1" },
      partial: { quota: { maxQueueSize: 8 } } as PartialPolicy,
      config: { defaultMode: "OVERRIDE" },
    },
    {
      target: { condominioId: "c1", areaId: "a1", opcaoId: "op1" },
      partial: { quota: { maxQueueSize: 3 } } as PartialPolicy,
      config: { defaultMode: "OVERRIDE" },
    },
  ]);

  assert.equal(resolved.policy.quota.maxQueueSize, 3); // OPCAO vence
  assert.equal(resolved.provenance["quota.maxQueueSize"], "OPCAO");
});

test("D810 herança — modo INHERIT mantém valor da camada anterior", () => {
  const base = structuredClone(DEFAULT_POLICY);

  const resolved = HerancaUtils.resolveHeranca(base, [
    {
      target: { condominioId: "c1", areaId: "a1" },
      partial: { cancellation: { minHoursBeforeEvent: 72 } } as PartialPolicy,
      config: { defaultMode: "OVERRIDE" },
    },
    {
      target: { condominioId: "c1", areaId: "a1" },
      partial: { cancellation: { minHoursBeforeEvent: 24 } } as PartialPolicy,
      config: { defaultMode: "INHERIT" },
    },
  ]);

  // INHERIT → mantém o valor da camada anterior (72), não 24
  assert.equal(resolved.policy.cancellation.minHoursBeforeEvent, 72);
});

test("D811 herança — modo EXTEND concatena arrays", () => {
  const base = structuredClone(DEFAULT_POLICY);
  base.holidays.fixedDates = ["12-25"];

  const resolved = HerancaUtils.resolveHeranca(base, [
    {
      target: { condominioId: "c1", areaId: "a1" },
      partial: { holidays: { fixedDates: ["01-01", "12-31"] } } as PartialPolicy,
      config: { defaultMode: "OVERRIDE", fieldOverrides: { "holidays.fixedDates": "EXTEND" } },
    },
  ]);

  assert.deepEqual(resolved.policy.holidays.fixedDates, ["12-25", "01-01", "12-31"]);
});

test("D812 herança — modo REPLACE substitui completamente", () => {
  const base = structuredClone(DEFAULT_POLICY);
  base.holidays.fixedDates = ["12-25", "01-01"];

  const resolved = HerancaUtils.resolveHeranca(base, [
    {
      target: { condominioId: "c1", areaId: "a1" },
      partial: { holidays: { fixedDates: ["05-01"] } } as PartialPolicy,
      config: { defaultMode: "OVERRIDE", fieldOverrides: { "holidays.fixedDates": "REPLACE" } },
    },
  ]);

  assert.deepEqual(resolved.policy.holidays.fixedDates, ["05-01"]);
});

// ═══════════════════════════════════ DEFAULTS D.8 ═══════════════════════════

test("D813 defaults — mergePolicyLayers sem camadas dá DEFAULT_POLICY (neutro)", () => {
  const { policy, provenance } = mergePolicyLayers([]);
  assert.deepEqual(policy, DEFAULT_POLICY);
  for (const level of Object.values(provenance)) assert.equal(level, "DEFAULT");
});

test("D814 defaults — mergePolicyLayers com camada DEFAULT explícita dá a política fornecida", () => {
  const { policy } = mergePolicyLayers([
    { level: "DEFAULT", data: LEGACY_POLICY_CHACARA_ITAGUAI as PartialPolicy },
  ]);
  assert.deepEqual(policy, LEGACY_POLICY_CHACARA_ITAGUAI);
});

// ════════════════════════════════ T1–T8 ISOLAMENTO ABSOLUTO ══════════════════

test("T1 Chácara sem política publicada → recebe LEGACY_POLICY_CHACARA_ITAGUAI", async () => {
  const repo = emptyRepo();
  const resolved = await resolvePolicy(repo, { condominioId: CHACARA_ID, areaId: "area1" }, NOW);
  assert.equal(resolved.policy.quota.maxQueueSize, 3);
  assert.equal(resolved.policy.weekdays.blockedWeekdays[0], 0);
  assert.equal(resolved.policy.holidays.mode, "BLOCK");
  assert.deepEqual(resolved.policy.holidays.fixedDates, ["12-24", "12-25", "12-31", "01-01"]);
});

test("T2 Condomínio novo sem política → recebe DEFAULT_POLICY (neutro)", async () => {
  const repo = emptyRepo();
  const resolved = await resolvePolicy(repo, { condominioId: "condNovo123", areaId: "area1" }, NOW);
  assert.deepEqual(resolved.policy, DEFAULT_POLICY);
});

test("T3 Condomínio novo NUNCA recebe domingo bloqueado", async () => {
  const repo = emptyRepo();
  const resolved = await resolvePolicy(repo, { condominioId: "condNovo456", areaId: "area1" }, NOW);
  assert.deepEqual(resolved.policy.weekdays.blockedWeekdays, []);
});

test("T4 Condomínio novo NUNCA recebe feriados da Chácara", async () => {
  const repo = emptyRepo();
  const resolved = await resolvePolicy(repo, { condominioId: "condNovo789", areaId: "area1" }, NOW);
  assert.deepEqual(resolved.policy.holidays.fixedDates, []);
  assert.equal(resolved.policy.holidays.mode, "ALLOW");
});

test("T5 Condomínio novo NUNCA recebe limite mensal da Chácara", async () => {
  const repo = emptyRepo();
  const resolved = await resolvePolicy(repo, { condominioId: "condNovo999", areaId: "area1" }, NOW);
  assert.equal(resolved.policy.quota.maxQueueSize, 0);
  assert.equal(resolved.policy.cancellation.minHoursBeforeEvent, 0);
  assert.equal(resolved.policy.queue.offerDurationMinutes, 0);
});

test("T6 Snapshot de condomínio novo NÃO contém hash da Chácara", () => {
  const snap = legacySnapshot(
    { condominioId: "condNovoX", areaId: "area1" },
    NOW,
  );
  assert.notEqual(snap.policyHash, policyHash(LEGACY_POLICY_CHACARA_ITAGUAI));
  assert.equal(snap.policyHash, policyHash(DEFAULT_POLICY));
  assert.deepEqual(snap.policy, DEFAULT_POLICY);
});

test("T7 Registry vazio → condomínio novo recebe DEFAULT_POLICY", () => {
  // Simula: registry sem o condomínio consultado
  const policy = getLegacyPolicyForCondominio("condInexistenteZZZ");
  assert.equal(policy, null);
});

test("T8 Registry somente Chácara → apenas ela recebe LEGACY_POLICY_CHACARA_ITAGUAI", () => {
  assert.equal(getLegacyPolicyForCondominio(CHACARA_ID), LEGACY_POLICY_CHACARA_ITAGUAI);
  assert.equal(getLegacyPolicyForCondominio("qualquerOutroId"), null);
  assert.equal(getLegacyPolicyForCondominio(""), null);
});

test("T9 cond1 → null (alias de testes removido do Registry de produção)", () => {
  assert.equal(getLegacyPolicyForCondominio("cond1"), null);
});

test("T10 Registry de produção — exatamente 1 entrada (Chácara Itaguaí)", () => {
  const entries = Object.keys(LEGACY_POLICY_REGISTRY);
  assert.equal(entries.length, 1);
  assert.equal(entries[0], CHACARA_ID);
});

test("T11 Nenhum alias — qualquer ID desconhecido retorna null; só a Chácara retorna política", () => {
  assert.equal(getLegacyPolicyForCondominio("cond1"), null);
  assert.equal(getLegacyPolicyForCondominio("foo"), null);
  assert.equal(getLegacyPolicyForCondominio("bar"), null);
  assert.equal(getLegacyPolicyForCondominio(""), null);
  assert.notEqual(getLegacyPolicyForCondominio(CHACARA_ID), null);
});

// ── Helper ────────────────────────────────────────────────────────────────────

function emptyRepo(): PolicyRepository {
  return {
    getPublishedVersion: async () => ({ version: 0, publishedAt: null }),
    getCondominioPolicy: async () => null,
    getAreaPolicy: async () => null,
    getOpcaoPolicy: async () => null,
    getMemberFacts: async (_, uid) => ({ uid, exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null, isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null }),
    getQuotaFacts: async () => ({ monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 0 }),
  };
}
