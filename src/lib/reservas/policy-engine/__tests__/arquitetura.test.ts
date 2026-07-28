/**
 * FASE D.3 — TESTES DE ARQUITETURA DO POLICY ENGINE.
 *
 * Complementam os 33 cenários homologados, cobrindo os ajustes obrigatórios
 * da homologação D.2→D.3: resolver hierárquico, compiler, cache por versão,
 * snapshot/versionamento, explain() e mapeamento legado dos adapters.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSnapshot,
  compilePolicy,
  createCachedPolicyRepository,
  DEFAULT_POLICY,
  LEGACY_POLICY_CHACARA_ITAGUAI,
  explain,
  getPolicyForReserva,
  legacySnapshot,
  makeContext,
  mergePolicyLayers,
  policyHash,
  resolvePolicy,
  validate,
  LEGACY_POLICY_VERSION,
  type PartialPolicy,
  type PolicyRepository,
  type PolicyTargetRef,
  type PolicyVersionInfo,
} from "../index";
import { compileSnapshot } from "../compiler";
import { noonUtcMs } from "../rules/_shared";
import { easterOf, movableHolidaysOf } from "../rules/holiday.rule";
import {
  mapLegacyArea,
  mapLegacyCondominioConfig,
  mapLegacyOpcao,
} from "../adapters/legacy-mapping";

const NOW = new Date("2026-07-15T15:00:00.000Z");
const TARGET: PolicyTargetRef = { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas", opcaoId: "com_campo" };

function fakeRepo(over: Partial<PolicyRepository> = {}): PolicyRepository {
  return {
    getPublishedVersion: async () => ({ version: 0, publishedAt: null }),
    getCondominioPolicy: async () => null,
    getAreaPolicy: async () => null,
    getOpcaoPolicy: async () => null,
    getMemberFacts: async (_, uid) => ({
      uid, exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null,
      isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null,
    }),
    getQuotaFacts: async () => ({ monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 0 }),
    ...over,
  };
}

// ── Resolver: hierarquia Opção → Área → Condomínio → Default ────────────────

test("A01 resolver — Opção vence Área, que vence Condomínio, que vence Default (nunca o contrário)", async () => {
  const repo = fakeRepo({
    getCondominioPolicy: async () => ({ quota: { maxQueueSize: 10 }, cancellation: { minHoursBeforeEvent: 24 } } as PartialPolicy),
    getAreaPolicy: async () => ({ quota: { maxQueueSize: 7 } } as PartialPolicy),
    getOpcaoPolicy: async () => ({ quota: { maxQueueSize: 5 } } as PartialPolicy),
  });
  const resolved = await resolvePolicy(repo, TARGET, NOW);

  assert.equal(resolved.policy.quota.maxQueueSize, 5); // OPCAO vence
  assert.equal(resolved.policy.cancellation.minHoursBeforeEvent, 24); // CONDOMINIO
  assert.equal(resolved.policy.booking.autoApproveAfterHours, 24); // DEFAULT

  assert.equal(resolved.provenance["quota.maxQueueSize"], "OPCAO");
  assert.equal(resolved.provenance["cancellation.minHoursBeforeEvent"], "CONDOMINIO");
  assert.equal(resolved.provenance["booking.autoApproveAfterHours"], "DEFAULT");
});

test("A02 resolver — sem nenhuma camada ⇒ política LEGACY_POLICY (compat retroativa D.8)", async () => {
  const resolved = await resolvePolicy(fakeRepo(), TARGET, NOW);
  assert.deepEqual(resolved.policy, LEGACY_POLICY_CHACARA_ITAGUAI);
  assert.equal(resolved.version, LEGACY_POLICY_VERSION);
  for (const level of Object.values(resolved.provenance)) assert.equal(level, "DEFAULT");
});

test("A03 mergePolicyLayers — merge é por campo folha; camada parcial não apaga irmãos", () => {
  const { policy } = mergePolicyLayers([
    { level: "AREA", data: { cancellation: { minHoursBeforeEvent: 72 } } as PartialPolicy },
  ]);
  assert.equal(policy.cancellation.minHoursBeforeEvent, 72);
  assert.equal(policy.cancellation.operatorBypass, true); // irmão preservado do default
});

// ── Compiler ─────────────────────────────────────────────────────────────────

test("A04 compiler — merge acontece uma vez; runtime traz índices pré-computados e é imutável", async () => {
  const compiled = compilePolicy(await resolvePolicy(fakeRepo(), TARGET, NOW), NOW);
  assert.ok(compiled.blockedWeekdaySet.has(0));
  assert.ok(compiled.blockedFixedDateSet.has("12-25"));
  assert.equal(compiled.hash, policyHash(LEGACY_POLICY_CHACARA_ITAGUAI));
  assert.ok(Object.isFrozen(compiled));
});

test("A05 compiler/feriados móveis — Páscoa/Carnaval calculados (desligados na v0)", () => {
  assert.deepEqual(easterOf(2026), [4, 5]); // Páscoa 2026: 05/04
  const movable2026 = movableHolidaysOf(2026);
  assert.ok(movable2026.includes("2026-02-16")); // segunda de Carnaval
  assert.ok(movable2026.includes("2026-02-17")); // terça de Carnaval

  // v0 (homologado): Carnaval NÃO bloqueia.
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const ctxCarnaval = makeContext({
    now: new Date("2026-01-10T15:00:00.000Z"),
    dateStr: "2026-02-17",
    target: TARGET,
    actor: {
      uid: "u", exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null,
      isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null,
    },
  });
  assert.equal(validate("CREATE", v0, ctxCarnaval).allowed, true);

  // Política futura com includeMovable=true ⇒ bloqueia (pronto para D.6).
  const comCarnaval = compileSnapshot(
    {
      ...legacySnapshot(TARGET, NOW),
      policy: { ...LEGACY_POLICY_CHACARA_ITAGUAI, holidays: { ...LEGACY_POLICY_CHACARA_ITAGUAI.holidays, includeMovable: true } },
    },
    NOW
  );
  const r = validate("CREATE", comCarnaval, ctxCarnaval);
  assert.equal(r.allowed, false);
  assert.equal(r.violations[0]?.code, "FERIADO_BLOQUEADO");
});

// ── Repository: cache invalidado por policyVersion (jamais por tempo) ───────

test("A06 cache — hit por versão: Firestore consultado uma única vez por corpo de política", async () => {
  let loads = 0;
  const repo = createCachedPolicyRepository(
    fakeRepo({
      getCondominioPolicy: async () => {
        loads++;
        return { quota: { maxQueueSize: 4 } } as PartialPolicy;
      },
    })
  );
  await repo.getCondominioPolicy("cond1");
  await repo.getCondominioPolicy("cond1");
  await repo.getCondominioPolicy("cond1");
  assert.equal(loads, 1);
});

test("A07 cache — publicar nova policyVersion invalida o cache imediatamente", async () => {
  let version = 1;
  let loads = 0;
  const repo = createCachedPolicyRepository(
    fakeRepo({
      getPublishedVersion: async (): Promise<PolicyVersionInfo> => ({ version, publishedAt: null }),
      getCondominioPolicy: async () => {
        loads++;
        return { quota: { maxQueueSize: version } } as PartialPolicy;
      },
    })
  );
  const before = await repo.getCondominioPolicy("cond1");
  assert.equal((before as { quota?: { maxQueueSize?: number } })?.quota?.maxQueueSize, 1);
  assert.equal(loads, 1);

  version = 2; // publicação de nova versão
  const after = await repo.getCondominioPolicy("cond1");
  assert.equal((after as { quota?: { maxQueueSize?: number } })?.quota?.maxQueueSize, 2);
  assert.equal(loads, 2); // recarregou — invalidação por versão, não por tempo
});

test("A08 cache — fatos (membro/quota) nunca são cacheados", async () => {
  let memberLoads = 0;
  const repo = createCachedPolicyRepository(
    fakeRepo({
      getMemberFacts: async (_, uid) => {
        memberLoads++;
        return {
          uid, exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null,
          isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null,
        };
      },
    })
  );
  await repo.getMemberFacts("cond1", "u1");
  await repo.getMemberFacts("cond1", "u1");
  assert.equal(memberLoads, 2);
});

// ── Snapshot e versionamento ─────────────────────────────────────────────────

test("A09 snapshot — buildSnapshot congela política, versão, hash e schema", async () => {
  const resolved = await resolvePolicy(fakeRepo(), TARGET, NOW);
  const snap = buildSnapshot(resolved, NOW);
  assert.equal(snap.policyVersion, LEGACY_POLICY_VERSION);
  assert.equal(snap.engineSchemaVersion, 1);
  assert.equal(snap.policyHash, policyHash(resolved.policy));
  assert.deepEqual(snap.policy, resolved.policy);
  assert.equal(snap.frozenAt, NOW.toISOString());
});

test("A10 snapshot — hash é estável e canônico (ordem de chaves não importa)", () => {
  function reverseKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).reverse()) {
        out[key] = reverseKeys((value as Record<string, unknown>)[key]);
      }
      return out;
    }
    return value;
  }
  const reordered = reverseKeys(DEFAULT_POLICY) as typeof DEFAULT_POLICY;
  assert.equal(policyHash(DEFAULT_POLICY), policyHash(reordered));
});

test("A11 compat — reserva ANTIGA (sem snapshot) recebe política legada v0 (LEGACY_POLICY D.8)", () => {
  const compiled = getPolicyForReserva(
    { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas" },
    NOW
  );
  assert.equal(compiled.version, LEGACY_POLICY_VERSION);
  assert.deepEqual(compiled.policy, LEGACY_POLICY_CHACARA_ITAGUAI);
});

test("A12 compat — reserva com snapshot NUNCA muda de regra quando o regulamento muda", () => {
  // Reserva congelada com janela de 48h.
  const snapshotAntigo = legacySnapshot(TARGET, NOW);
  const compiled = getPolicyForReserva(
    { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas", policyVersion: 0, policySnapshot: snapshotAntigo },
    NOW
  );
  // Mesmo que a política vigente mude para 12h, a reserva antiga segue 48h.
  assert.equal(compiled.policy.cancellation.minHoursBeforeEvent, 48);

  const ctxCancel = makeContext({
    now: NOW,
    dateStr: "2026-07-16",
    target: TARGET,
    actor: {
      uid: "u", exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null,
      isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null,
    },
    reserva: { eventMs: noonUtcMs("2026-07-16"), status: "APROVADA", valorCobradoCentavos: 0 },
  });
  assert.equal(validate("CANCEL", compiled, ctxCancel).allowed, false); // 21h < 48h
});

// ── explain() (ajuste D.3 §4) ────────────────────────────────────────────────

test("A13 explain — artigo, regra, resultado, valor utilizado, origem e mensagem", async () => {
  const repo = fakeRepo({
    getCondominioPolicy: async () => ({ cancellation: { minHoursBeforeEvent: 72 } } as PartialPolicy),
  });
  const compiled = compilePolicy(await resolvePolicy(repo, TARGET, NOW), NOW);
  const ctxCancel = makeContext({
    now: NOW,
    dateStr: "2026-07-16",
    target: TARGET,
    actor: {
      uid: "u", exists: true, status: "ATIVO", role: "MORADOR", blocoIdNorm: null, unidadeIdNorm: null,
      isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null,
    },
    reserva: { eventMs: noonUtcMs("2026-07-16"), status: "APROVADA", valorCobradoCentavos: 0 },
  });

  const trail = explain("CANCEL", compiled, ctxCancel);
  const cancel = trail.find((t) => t.ruleCode === "CANCELAMENTO_TARDIO");
  assert.ok(cancel);
  assert.match(cancel.article, /Cancelamento/);
  assert.equal(cancel.outcome, "FAIL");
  assert.equal(cancel.valueUsed, 72); // valor efetivamente utilizado
  assert.equal(cancel.origin, "CONDOMINIO"); // origem hierárquica da política
  assert.match(cancel.message, /72h/);

  const membro = trail.find((t) => t.ruleCode === "MEMBRO_INATIVO");
  assert.ok(membro);
  assert.equal(membro.outcome, "PASS");
  assert.equal(membro.origin, "DEFAULT");
});

// ── Adapters: mapeamento legado (paridade com o servidor) ────────────────────

test("A14 legado — config/reservas: horas de aprovação mapeadas; defeitos oficiais preservados", () => {
  const mapped = mapLegacyCondominioConfig({
    bloquearDomingo: false,
    cancelamentoMinHoras: 12,
    autoAprovarAposHoras: 48,
    exigirAprovacaoQuandoMenosQueHoras: 36,
  });
  const { policy } = mergePolicyLayers([
    { level: "CONDOMINIO", data: mapped },
    { level: "DEFAULT", data: LEGACY_POLICY_CHACARA_ITAGUAI as unknown as PartialPolicy },
  ]);
  assert.equal(policy.booking.autoApproveAfterHours, 48);
  assert.equal(policy.booking.requireApprovalUnderHours, 36);
  assert.deepEqual(policy.weekdays.blockedWeekdays, [0]);
  assert.equal(policy.cancellation.minHoursBeforeEvent, 48);
});

test("A15 legado — área estilo C.1 (escopo BLOCO, preço, capacidade) vira política de área", () => {
  const mapped = mapLegacyArea({
    nome: "Salão de Festas — Bloco Rosas",
    ativo: true,
    escopoReserva: "BLOCO",
    blocosPermitidos: ["Rosas"],
    capacidadeMax: 60,
    precoCentavos: 25000,
    opcoes: [{ id: "com_campo", nome: "Churrasqueira 2 + Campo", precoCentavos: 28000 }],
  });
  const { policy, provenance } = mergePolicyLayers([{ level: "AREA", data: mapped }]);
  assert.equal(policy.eligibility.scope, "BLOCO");
  assert.deepEqual(policy.eligibility.allowedBlocks, ["rosas"]); // normalizado
  assert.equal(policy.capacity.maxPeople, 60);
  assert.equal(policy.financial.feeCentavos, 25000);
  assert.equal(provenance["eligibility.allowedBlocks"], "AREA");

  const opcao = mapLegacyOpcao(
    { opcoes: [{ id: "com_campo", precoCentavos: 28000 }] },
    "com_campo"
  );
  const merged = mergePolicyLayers([
    { level: "OPCAO", data: opcao },
    { level: "AREA", data: mapped },
    { level: "DEFAULT", data: LEGACY_POLICY_CHACARA_ITAGUAI as unknown as PartialPolicy },
  ]);
  assert.equal(merged.policy.financial.feeCentavos, 28000); // opção vence área
  assert.equal(merged.provenance["financial.feeCentavos"], "OPCAO");
});

test("A16 CHECK_IN — sem regras impeditivas hoje ⇒ permitido (fluxo de portaria congelado)", () => {
  const v0 = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);
  const r = validate("CHECK_IN", v0, makeContext({
    now: NOW,
    dateStr: "2026-07-15",
    target: TARGET,
    actor: {
      uid: "porteiro", exists: true, status: "ATIVO", role: "PORTEIRO", blocoIdNorm: null, unidadeIdNorm: null,
      isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null,
    },
  }));
  assert.equal(r.allowed, true);
});
