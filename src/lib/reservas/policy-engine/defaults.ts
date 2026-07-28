/**
 * FASE D.3 — POLICY ENGINE — DEFAULTS.
 *
 * FASE D.8.1 (P0 ARCH): Isolamento absoluto entre condomínios.
 *
 *   DEFAULT_POLICY                   → Valores técnicos MÍNIMOS de compatibilidade.
 *                                      ZERO regras de condomínio. ZERO comportamento
 *                                      da Chácara. Apenas o necessário para o engine
 *                                      funcionar (sem bloqueios, sem limites, tudo
 *                                      permissivo).
 *
 *   LEGACY_POLICY_CHACARA_ITAGUAI    → Regulamento homologado da Chácara Itaguaí (v0).
 *                                      Pertence EXCLUSIVAMENTE ao condomínio
 *                                      RtJ7G92QwWvJ13Qq8Ntx.
 *
 *   LEGACY_POLICY_REGISTRY           → Mapeia condominioId → PolicyDocument.
 *                                      ÚNICO ponto onde um condomínio pode receber
 *                                      uma política legada. Condomínios não listados
 *                                      NUNCA herdam política de outro condomínio.
 */

import type { PolicyDocument } from "./types";

/** Valores puramente neutros/permissivos — nenhuma regra de condomínio. */
export const DEFAULT_POLICY: PolicyDocument = {
  booking: {
    minAdvanceHours: 0, // mesmo dia permitido
    maxAdvanceDays: null, // sem horizonte
    autoApproveAfterHours: 0, // aprovação imediata (sem regra de 24h)
    requireApprovalUnderHours: 0, // sem janela de aprovação
    allowPastDates: false,
  },
  weekdays: {
    blockedWeekdays: [], // nenhum dia bloqueado
  },
  holidays: {
    mode: "ALLOW", // sem bloqueio de feriados
    fixedDates: [], // nenhuma data fixa
    includeMovable: false,
    custom: [],
  },
  schedule: {
    allDay: true,
    startHour: null,
    endHour: null,
  },
  campo: {
    horaInicio: null,
    horaFim: null,
    excecaoHorarioEstendido: {
      habilitada: false,
      horaFim: null,
    },
    exclusividade: {
      habilitada: false,
      diasPermitidos: [],
      horaInicio: null,
      horaFim: null,
      holdHoras: null,
    },
  },
  capacity: {
    maxPeople: null,
    guestList: {
      required: false,
      maxGuests: null,
      submitDeadlineHours: 0,
      lockAfterDeadline: false,
    },
  },
  quota: {
    maxPerMonthPerUnit: null, // sem limite mensal
    maxActiveFuturePerUnit: null, // sem limite de reservas ativas
    maxQueueSize: 0, // sem fila (condomínio define)
  },
  cancellation: {
    minHoursBeforeEvent: 0, // cancelamento a qualquer momento
    lateCancelAllowed: true,
    noShowTrackingEnabled: false,
    noShowSuspensionDays: null,
    operatorBypass: true,
    noShowPenaltyCentavos: null,
  },
  financial: {
    requiresPaidUpMember: false,
    feeCentavos: null,
    holidayFeeCentavos: null,
    lateCancelFeeCentavos: null,
  },
  checkin: {
    required: false,
  },
  eligibility: {
    requireActiveMember: true,
    scope: "CONDOMINIO",
    allowedBlocks: null,
  },
  queue: {
    offerDurationMinutes: 0, // condomínio define
  },
  convidados: {
    habilitado: false,
    saldoMensalPorUnidade: null,
    reinicioDia: null,
  },
};

/**
 * Regulamento da Chácara Itaguaí — comportamento homologado nas fases D.2-D.7.
 *
 * PERTENCE EXCLUSIVAMENTE ao condomínio `RtJ7G92QwWvJ13Qq8Ntx`.
 * NENHUM outro condomínio pode utilizar esta política.
 */
export const LEGACY_POLICY_CHACARA_ITAGUAI: PolicyDocument = {
  booking: {
    minAdvanceHours: 0,
    maxAdvanceDays: null,
    autoApproveAfterHours: 24,
    requireApprovalUnderHours: 24,
    allowPastDates: false,
  },
  weekdays: {
    blockedWeekdays: [0], // domingo bloqueado
  },
  holidays: {
    mode: "BLOCK",
    fixedDates: ["12-24", "12-25", "12-31", "01-01"],
    includeMovable: false,
    custom: [],
  },
  schedule: {
    allDay: true,
    startHour: null,
    endHour: null,
  },
  campo: {
    horaInicio: 6,
    horaFim: 22,
    excecaoHorarioEstendido: {
      habilitada: false,
      horaFim: 23,
    },
    exclusividade: {
      habilitada: true,
      diasPermitidos: [2, 3],
      horaInicio: 18,
      horaFim: 22,
      holdHoras: 24,
    },
  },
  capacity: {
    maxPeople: null,
    guestList: {
      required: false,
      maxGuests: null,
      submitDeadlineHours: 0,
      lockAfterDeadline: false,
    },
  },
  quota: {
    maxPerMonthPerUnit: null,
    maxActiveFuturePerUnit: null,
    maxQueueSize: 3,
  },
  cancellation: {
    minHoursBeforeEvent: 48,
    lateCancelAllowed: false,
    noShowTrackingEnabled: false,
    noShowSuspensionDays: null,
    operatorBypass: true,
    noShowPenaltyCentavos: null,
  },
  financial: {
    requiresPaidUpMember: false,
    feeCentavos: null,
    holidayFeeCentavos: null,
    lateCancelFeeCentavos: null,
  },
  checkin: {
    required: false,
  },
  eligibility: {
    requireActiveMember: true,
    scope: "CONDOMINIO",
    allowedBlocks: null,
  },
  queue: {
    offerDurationMinutes: 120,
  },
  convidados: {
    habilitado: true,
    saldoMensalPorUnidade: 8,
    reinicioDia: 1,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FASE D.8.1 — LEGACY POLICY REGISTRY (ISOLAMENTO ABSOLUTO)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registry de compatibilidade.
 *
 * Mapeia condominioId → PolicyDocument para condomínios que migraram do motor
 * congelado e ainda não publicaram seu regulamento no Firestore.
 *
 * REGRA: Somente condomínios explicitamente listados aqui recebem política legada.
 *        Condomínios NÃO listados recebem DEFAULT_POLICY (neutra, permissiva).
 *
 * Quando um condomínio publicar seu regulamento (D.9), sua entrada pode ser
 * removida deste registry — o Firestore passa a ser a fonte da verdade.
 */
export const LEGACY_POLICY_REGISTRY: Readonly<Record<string, PolicyDocument>> = {
  /** Chácara Itaguaí — primeiro e único condomínio com regulamento homologado. */
  "RtJ7G92QwWvJ13Qq8Ntx": LEGACY_POLICY_CHACARA_ITAGUAI,
};

/**
 * Busca a política legada APENAS para o condomínio especificado.
 * Retorna null para qualquer condomínio não registrado.
 *
 * USO OBRIGATÓRIO em resolver e snapshots. É PROIBIDO usar
 * LEGACY_POLICY_CHACARA_ITAGUAI diretamente como fallback.
 */
export function getLegacyPolicyForCondominio(condominioId: string): PolicyDocument | null {
  return LEGACY_POLICY_REGISTRY[condominioId] ?? null;
}
