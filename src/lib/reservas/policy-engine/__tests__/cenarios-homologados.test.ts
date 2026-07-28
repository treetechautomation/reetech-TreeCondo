/**
 * FASE D.3 — SUÍTE OFICIAL — 33 CENÁRIOS HOMOLOGADOS.
 *
 * Cada teste reproduz um cenário homologado do módulo Reservas congelado e
 * verifica que o Policy Engine (política legada v0) devolve EXATAMENTE a
 * mesma decisão do motor atual. Referências de paridade nos comentários.
 *
 * Execução: npm run test:policy-engine  (node:test via tsx — sem framework novo)
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  compileSnapshot,
  legacySnapshot,
  makeContext,
  validate,
  type CompiledPolicy,
  type MemberFacts,
  type PolicyContext,
  type PolicyTargetRef,
} from "../index";
import { noonUtcMs } from "../rules/_shared";

// ── Fixtures determinísticas ─────────────────────────────────────────────────
// "Agora": 2026-07-15 12:00 em America/Sao_Paulo (15:00Z). Hoje = 2026-07-15.
const NOW = new Date("2026-07-15T15:00:00.000Z");
const TARGET: PolicyTargetRef = { condominioId: "RtJ7G92QwWvJ13Qq8Ntx", areaId: "salao_festas" };

const POLICY_V0: CompiledPolicy = compileSnapshot(legacySnapshot(TARGET, NOW), NOW);

const MONDAY_FUTURE = "2026-07-20"; // segunda, ~117h à frente (>24h)
const TOMORROW = "2026-07-16"; // ~21h à frente (<24h)
const TODAY = "2026-07-15";
const YESTERDAY = "2026-07-14";
const SUNDAY = "2026-07-19";

function membroAtivo(over: Partial<MemberFacts> = {}): MemberFacts {
  const base: MemberFacts = {
    uid: "uid-morador",
    exists: true,
    status: "ATIVO",
    role: "MORADOR",
    blocoIdNorm: "rosas",
    unidadeIdNorm: null,
    isSuperAdmin: false,
    isPaidUp: null,
    recentNoShows: 0,
    suspendedUntil: null,
  };
  const merged = { ...base, ...over };
  if (over.unidadeIdNorm !== undefined) merged.unidadeIdNorm = over.unidadeIdNorm;
  return merged;
}

function ctx(over: Partial<PolicyContext> & { dateStr?: string } = {}): PolicyContext {
  return makeContext({
    now: NOW,
    dateStr: over.dateStr ?? MONDAY_FUTURE,
    target: TARGET,
    actor: membroAtivo(),
    ...over,
  });
}

function codes(violations: Array<{ code: string }>): string[] {
  return violations.map((v) => v.code);
}

// ═════════════════════════════════════════════ CREATE (cenários 1–16) ═══════

test("C01 CREATE — slot livre, sem taxa, >24h ⇒ permitida e AUTO-APROVADA (criar/route.ts:165)", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ priceCentavos: 0 }));
  assert.equal(r.allowed, true);
  assert.equal(r.requiresApproval, false); // horas >= 24 ⇒ APROVADA
  assert.equal(r.financial.requiresPaymentBeforeApproval, false);
});

test("C02 CREATE — sem taxa, <24h ⇒ permitida mas PENDENTE de aprovação (criar/route.ts:166)", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ dateStr: TOMORROW, priceCentavos: 0 }));
  assert.equal(r.allowed, true);
  assert.equal(r.requiresApproval, true);
});

test("C03 CREATE — com taxa ⇒ nasce PENDENTE_PAGAMENTO independente das horas (criar/route.ts:165)", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ priceCentavos: 25000 }));
  assert.equal(r.allowed, true);
  assert.equal(r.financial.requiresPaymentBeforeApproval, true);
  assert.equal(r.financial.feeCentavos, 25000);
  assert.equal(r.requiresApproval, false); // precisaAprovacao = !hasFee && ...
});

test("C04 CREATE — data passada ⇒ bloqueada (criar/route.ts:100)", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ dateStr: YESTERDAY }));
  assert.equal(r.allowed, false);
  assert.deepEqual(codes(r.violations), ["DATA_PASSADA"]);
});

test("C05 CREATE — mesmo dia (hoje) ⇒ permitida; exige aprovação por <24h (criar/route.ts:100,166)", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ dateStr: TODAY, priceCentavos: 0 }));
  assert.equal(r.allowed, true);
  assert.equal(r.requiresApproval, true);
});

test("C06 CREATE — domingo ⇒ bloqueado sempre no servidor (criar/route.ts:105)", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ dateStr: SUNDAY }));
  assert.equal(r.allowed, false);
  assert.ok(codes(r.violations).includes("DIA_SEMANA_BLOQUEADO"));
});

test("C07 CREATE — Natal 25/12 ⇒ feriado bloqueado (criar/route.ts:37-41)", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ dateStr: "2026-12-25" }));
  assert.equal(r.allowed, false);
  assert.ok(codes(r.violations).includes("FERIADO_BLOQUEADO"));
});

test("C08 CREATE — véspera de Natal 24/12 ⇒ feriado bloqueado", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ dateStr: "2026-12-24" }));
  assert.equal(r.allowed, false);
  assert.ok(codes(r.violations).includes("FERIADO_BLOQUEADO"));
});

test("C09 CREATE — véspera de Ano Novo 31/12 ⇒ feriado bloqueado", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ dateStr: "2026-12-31" }));
  assert.equal(r.allowed, false);
  assert.ok(codes(r.violations).includes("FERIADO_BLOQUEADO"));
});

test("C10 CREATE — Ano Novo 01/01 ⇒ feriado bloqueado", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ dateStr: "2027-01-01" }));
  assert.equal(r.allowed, false);
  assert.ok(codes(r.violations).includes("FERIADO_BLOQUEADO"));
});

test("C11 CREATE — membro inativo ⇒ BLOCKER interrompe imediatamente (criar/route.ts:255-259)", () => {
  // Cenário composto: membro inativo EM um domingo — só o BLOCKER deve aparecer.
  const r = validate(
    "CREATE",
    POLICY_V0,
    ctx({ dateStr: SUNDAY, actor: membroAtivo({ status: "SUSPENSO" }) })
  );
  assert.equal(r.allowed, false);
  assert.equal(r.haltedByBlocker, true);
  assert.deepEqual(codes(r.violations), ["MEMBRO_INATIVO"]);
  // regras posteriores (domingo) não foram avaliadas
  assert.ok(!r.results.some((x) => x.code === "DIA_SEMANA_BLOQUEADO"));
});

test("C12 CREATE — super admin sem cadastro de membro ⇒ check ignorado (criar/route.ts:255)", () => {
  const r = validate(
    "CREATE",
    POLICY_V0,
    ctx({ actor: membroAtivo({ exists: false, status: "", isSuperAdmin: true }) })
  );
  assert.equal(r.allowed, true);
});

test("C13 CREATE — área desativada ⇒ bloqueada (criar/route.ts:113)", () => {
  const r = validate("CREATE", POLICY_V0, ctx({ area: { ativo: false } }));
  assert.equal(r.allowed, false);
  assert.deepEqual(codes(r.violations), ["AREA_INATIVA"]);
  assert.equal(r.haltedByBlocker, true);
});

test("C14 CREATE — área escopo BLOCO, morador de outro bloco ⇒ bloqueado (criar/route.ts:272-277)", () => {
  const compiled = compileSnapshot(
    {
      ...legacySnapshot(TARGET, NOW),
      policy: {
        ...POLICY_V0.policy,
        eligibility: { requireActiveMember: true, scope: "BLOCO", allowedBlocks: ["rosas"] },
      },
    },
    NOW
  );
  const r = validate("CREATE", compiled, ctx({ actor: membroAtivo({ blocoIdNorm: "dalias" }) }));
  assert.equal(r.allowed, false);
  assert.deepEqual(codes(r.violations), ["BLOCO_NAO_PERMITIDO"]);
});

test("C15 CREATE — área escopo BLOCO, morador do bloco permitido ⇒ permitida", () => {
  const compiled = compileSnapshot(
    {
      ...legacySnapshot(TARGET, NOW),
      policy: {
        ...POLICY_V0.policy,
        eligibility: { requireActiveMember: true, scope: "BLOCO", allowedBlocks: ["rosas"] },
      },
    },
    NOW
  );
  const r = validate("CREATE", compiled, ctx({ actor: membroAtivo({ blocoIdNorm: "rosas" }) }));
  assert.equal(r.allowed, true);
});

test("C16 CREATE — operador criando para morador ATIVO ⇒ permitida (criar/route.ts:178-227)", () => {
  const r = validate(
    "CREATE",
    POLICY_V0,
    ctx({ actor: membroAtivo({ uid: "uid-alvo" }), isOperatorAction: true })
  );
  assert.equal(r.allowed, true);
});

// ═══════════════════════════════════════ QUEUE_JOIN (cenários 17–19) ════════

test("C17 QUEUE_JOIN — fila com 2 ⇒ pode entrar (criar/route.ts:454)", () => {
  const r = validate(
    "QUEUE_JOIN",
    POLICY_V0,
    ctx({ quota: { monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 2 } })
  );
  assert.equal(r.allowed, true);
});

test("C18 QUEUE_JOIN — fila com 3 ⇒ fila cheia (criar/route.ts:454)", () => {
  const r = validate(
    "QUEUE_JOIN",
    POLICY_V0,
    ctx({ quota: { monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 3 } })
  );
  assert.equal(r.allowed, false);
  assert.deepEqual(codes(r.violations), ["FILA_CHEIA"]);
  const v = r.violations[0];
  assert.equal(v.valueUsed, 3); // limite vem da POLÍTICA, não de hardcode
});

test("C19 QUEUE_JOIN — política maxQueueSize=5, fila com 4 ⇒ pode entrar (configurável)", () => {
  const compiled = compileSnapshot(
    {
      ...legacySnapshot(TARGET, NOW),
      policy: { ...POLICY_V0.policy, quota: { ...POLICY_V0.policy.quota, maxQueueSize: 5 } },
    },
    NOW
  );
  const r = validate(
    "QUEUE_JOIN",
    compiled,
    ctx({ quota: { monthCountForUnit: 0, activeFutureForUnit: 0, queueSizeForSlot: 4 } })
  );
  assert.equal(r.allowed, true);
});

// ═══════════════════════════════════ QUEUE_PROMOTE (cenários 20–25) ═════════

test("C20 QUEUE_PROMOTE — candidato inativo ⇒ INELEGIVEL (reservasPromocaoFila.ts:79-87)", () => {
  const r = validate("QUEUE_PROMOTE", POLICY_V0, ctx({ actor: membroAtivo({ status: "PENDENTE" }) }));
  assert.equal(r.allowed, false);
  assert.deepEqual(codes(r.violations), ["MEMBRO_INATIVO"]);
});

test("C21 QUEUE_PROMOTE — domingo ⇒ INELEGIVEL (reservasPromocaoFila.ts:111-117)", () => {
  const r = validate("QUEUE_PROMOTE", POLICY_V0, ctx({ dateStr: SUNDAY }));
  assert.equal(r.allowed, false);
  assert.ok(codes(r.violations).includes("DIA_SEMANA_BLOQUEADO"));
});

test("C22 QUEUE_PROMOTE — feriado ⇒ INELEGIVEL (reservasPromocaoFila.ts:119-125)", () => {
  const r = validate("QUEUE_PROMOTE", POLICY_V0, ctx({ dateStr: "2026-12-25" }));
  assert.equal(r.allowed, false);
  assert.ok(codes(r.violations).includes("FERIADO_BLOQUEADO"));
});

test("C23 QUEUE_PROMOTE — data passada ⇒ INELEGIVEL (reservasPromocaoFila.ts:103-109)", () => {
  const r = validate("QUEUE_PROMOTE", POLICY_V0, ctx({ dateStr: YESTERDAY }));
  assert.equal(r.allowed, false);
  assert.deepEqual(codes(r.violations), ["DATA_PASSADA"]);
});

test("C24 QUEUE_PROMOTE — bloco não permitido ⇒ INELEGIVEL (reservasPromocaoFila.ts:90-99)", () => {
  const compiled = compileSnapshot(
    {
      ...legacySnapshot(TARGET, NOW),
      policy: {
        ...POLICY_V0.policy,
        eligibility: { requireActiveMember: true, scope: "BLOCO", allowedBlocks: ["dalias"] },
      },
    },
    NOW
  );
  const r = validate("QUEUE_PROMOTE", compiled, ctx({ actor: membroAtivo({ blocoIdNorm: "rosas" }) }));
  assert.equal(r.allowed, false);
  assert.deepEqual(codes(r.violations), ["BLOCO_NAO_PERMITIDO"]);
});

test("C25 QUEUE_PROMOTE — candidato elegível ⇒ oferta pode ser criada", () => {
  const r = validate("QUEUE_PROMOTE", POLICY_V0, ctx({}));
  assert.equal(r.allowed, true);
  // prazo da oferta vem da política (120 min homologados — reservasOfertaPrazo.ts:1)
  assert.equal(POLICY_V0.policy.queue.offerDurationMinutes, 120);
});

// ═══════════════════════════════════ OFFER_ACCEPT (cenários 26–28) ══════════

test("C26 OFFER_ACCEPT — oferta dentro do prazo ⇒ permitida (fila/aceitar:129-132)", () => {
  const r = validate(
    "OFFER_ACCEPT",
    POLICY_V0,
    ctx({ offer: { expiresAtMs: NOW.getTime() + 60 * 60 * 1000 } })
  );
  assert.equal(r.allowed, true);
});

test("C27 OFFER_ACCEPT — oferta expirada ⇒ bloqueada (isOfferExpired, reservasOfertaPrazo.ts:19)", () => {
  const r = validate(
    "OFFER_ACCEPT",
    POLICY_V0,
    ctx({ offer: { expiresAtMs: NOW.getTime() - 1000 } })
  );
  assert.equal(r.allowed, false);
  assert.deepEqual(codes(r.violations), ["OFERTA_EXPIRADA"]);
});

test("C28 OFFER_ACCEPT — oferta sem prazo registrado (null) ⇒ NÃO expirada (reservasOfertaPrazo.ts:4)", () => {
  const r = validate("OFFER_ACCEPT", POLICY_V0, ctx({ offer: { expiresAtMs: null } }));
  assert.equal(r.allowed, true);
});

// ═════════════════════════════════════════ CANCEL (cenários 29–32) ══════════

test("C29 CANCEL — mais de 48h antes ⇒ permitido; cobrança segue fluxo de estorno (cancelar/route.ts:184-195)", () => {
  const r = validate(
    "CANCEL",
    POLICY_V0,
    ctx({
      reserva: { eventMs: noonUtcMs(MONDAY_FUTURE), status: "APROVADA", valorCobradoCentavos: 25000 },
      priceCentavos: 25000,
    })
  );
  assert.equal(r.allowed, true);
  assert.equal(r.financial.cancellationOutcome, "REFUND");
});

test("C30 CANCEL — morador a menos de 48h ⇒ bloqueado (cancelar/route.ts:193-195)", () => {
  const r = validate(
    "CANCEL",
    POLICY_V0,
    ctx({
      reserva: { eventMs: noonUtcMs(TOMORROW), status: "APROVADA", valorCobradoCentavos: 0 },
    })
  );
  assert.equal(r.allowed, false);
  assert.deepEqual(codes(r.violations), ["CANCELAMENTO_TARDIO"]);
  assert.equal(r.violations[0].valueUsed, 48); // valor vem da política, não de hardcode
});

test("C31 CANCEL — operador a menos de 48h ⇒ permitido (bypass homologado, cancelar/route.ts:192-193)", () => {
  const r = validate(
    "CANCEL",
    POLICY_V0,
    ctx({
      isOperatorAction: true,
      actor: membroAtivo({ uid: "uid-sindico", role: "SINDICO" }),
      reserva: { eventMs: noonUtcMs(TOMORROW), status: "APROVADA", valorCobradoCentavos: 0 },
    })
  );
  assert.equal(r.allowed, true);
});

test("C32 CANCEL — membro inativo ⇒ bloqueado antes de qualquer outra regra (cancelar/route.ts:159-163)", () => {
  const r = validate(
    "CANCEL",
    POLICY_V0,
    ctx({
      actor: membroAtivo({ status: "INATIVO" }),
      reserva: { eventMs: noonUtcMs(MONDAY_FUTURE), status: "APROVADA", valorCobradoCentavos: 0 },
    })
  );
  assert.equal(r.allowed, false);
  assert.equal(r.haltedByBlocker, true);
  assert.deepEqual(codes(r.violations), ["MEMBRO_INATIVO"]);
});

// ═════════════════════════════════════════ APPROVE (cenário 33) ═════════════

test("C33 APPROVE — operador ativo aprova reserva pendente ⇒ permitido (aprovar/route.ts:84-118)", () => {
  const r = validate(
    "APPROVE",
    POLICY_V0,
    ctx({
      isOperatorAction: true,
      actor: membroAtivo({ uid: "uid-sindico", role: "SINDICO" }),
      reserva: { eventMs: noonUtcMs(MONDAY_FUTURE), status: "PENDENTE", valorCobradoCentavos: 0 },
    })
  );
  assert.equal(r.allowed, true);
});
