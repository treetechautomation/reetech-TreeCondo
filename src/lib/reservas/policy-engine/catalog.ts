/**
 * FASE D.3 — POLICY ENGINE — CATÁLOGO DE REGRAS.
 *
 * Ajuste obrigatório D.3 §2: este módulo NÃO contém lógica.
 * Responsabilidade única: registrar RuleCode → RuleEvaluator com metadados
 * (título, artigo do regulamento, prioridade, ações aplicáveis, policyPath).
 *
 * A ORDEM do array é a ordem de avaliação do validator e reproduz a ordem de
 * checks do motor congelado (membro → área → bloco → data → domingo → feriado
 * → antecedência → quotas → específicas da ação).
 */

import type { ReservaAction, RuleCode, RuleDescriptor } from "./types";
import { activeMemberRule } from "./rules/active-member.rule";
import { activeAreaRule } from "./rules/active-area.rule";
import { blockScopeRule } from "./rules/block.rule";
import { pastDateRule } from "./rules/past-date.rule";
import { offerExpiryRule } from "./rules/offer-expiry.rule";
import { weekdayRule } from "./rules/weekday.rule";
import { holidayRule } from "./rules/holiday.rule";
import { minAdvanceRule, maxAdvanceRule } from "./rules/advance.rule";
import { queueLimitRule, monthlyQuotaRule, activeFutureQuotaRule } from "./rules/quota.rule";
import { paidUpMemberRule, noShowSuspensionRule } from "./rules/payment.rule";
import { capacityRule, guestListLimitRule, guestListDeadlineRule } from "./rules/guest.rule";
import { cancellationWindowRule } from "./rules/cancellation.rule";
import { lateCancelPenaltyRule } from "./rules/late-cancel-penalty.rule";
import { guestListRequiredRule } from "./rules/guest-list-required.rule";
import { guestListLockRule } from "./rules/guest-list-lock.rule";
import { checkinRequiredRule } from "./rules/checkin-required.rule";
import { noShowPenaltyRule } from "./rules/no-show-penalty.rule";
import { scheduleWindowRule } from "./rules/schedule-window.rule";
import { adminBlockedDateRule } from "./rules/admin-blocked-date.rule";
import { campoForaHorarioRule } from "./rules/campo-fora-horario.rule";
import { campoExclusividadeDiaRule } from "./rules/campo-exclusividade-dia.rule";
import { campoExclusividadeSobreposicaoRule } from "./rules/campo-exclusividade-sobreposicao.rule";
import { saldoConvidadosRule } from "./rules/convidados-saldo.rule";

const ALL_BOOKING_ACTIONS: ReadonlyArray<ReservaAction> = [
  "CREATE",
  "QUEUE_JOIN",
  "QUEUE_PROMOTE",
  "OFFER_ACCEPT",
];

export const RULE_CATALOG: ReadonlyArray<RuleDescriptor> = [
  {
    code: "MEMBRO_INATIVO",
    title: "Membro ativo",
    article: "Regulamento — Elegibilidade (art. a mapear na D.6)",
    priority: "BLOCKER",
    appliesTo: [
      "CREATE", "CANCEL", "QUEUE_JOIN", "QUEUE_LEAVE", "QUEUE_PROMOTE",
      "OFFER_ACCEPT", "OFFER_REJECT", "APPROVE", "GUEST_LIST_EDIT",
    ],
    policyPath: "eligibility.requireActiveMember",
    evaluate: activeMemberRule,
  },
  {
    code: "AREA_INATIVA",
    title: "Área ativa",
    article: "Regulamento — Áreas comuns (art. a mapear na D.6)",
    priority: "BLOCKER",
    appliesTo: ["CREATE", "QUEUE_JOIN", "QUEUE_PROMOTE", "OFFER_ACCEPT"],
    policyPath: null,
    evaluate: activeAreaRule,
  },
  {
    code: "QUITACAO_PENDENTE",
    title: "Quitação / adimplência",
    article: "Regulamento — Quitação (art. a mapear na D.6)",
    priority: "BLOCKER",
    appliesTo: ALL_BOOKING_ACTIONS,
    policyPath: "financial.requiresPaidUpMember",
    evaluate: paidUpMemberRule,
  },
  {
    code: "SUSPENSO_NO_SHOW",
    title: "Suspensão por no-show",
    article: "Regulamento — No-show (art. a mapear na D.6)",
    priority: "BLOCKER",
    appliesTo: ALL_BOOKING_ACTIONS,
    policyPath: "cancellation.noShowSuspensionDays",
    evaluate: noShowSuspensionRule,
  },
  {
    code: "BLOCO_NAO_PERMITIDO",
    title: "Escopo de bloco",
    article: "Regulamento — Escopo por bloco (art. a mapear na D.6)",
    priority: "BLOCKER",
    appliesTo: ["CREATE", "QUEUE_JOIN", "QUEUE_PROMOTE", "OFFER_ACCEPT"],
    policyPath: "eligibility.allowedBlocks",
    evaluate: blockScopeRule,
  },
  {
    code: "OFERTA_EXPIRADA",
    title: "Prazo da oferta de vaga",
    article: "Regulamento — Fila de espera (art. a mapear na D.6)",
    priority: "BLOCKER",
    appliesTo: ["OFFER_ACCEPT", "OFFER_REJECT"],
    policyPath: "queue.offerDurationMinutes",
    evaluate: offerExpiryRule,
  },
  {
    code: "DATA_PASSADA",
    title: "Data passada",
    article: "Regulamento — Datas (art. a mapear na D.6)",
    priority: "BLOCKER",
    appliesTo: ALL_BOOKING_ACTIONS,
    policyPath: "booking.allowPastDates",
    evaluate: pastDateRule,
  },
  {
    code: "DIA_SEMANA_BLOQUEADO",
    title: "Dias da semana bloqueados",
    article: "Regulamento — Domingos (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ALL_BOOKING_ACTIONS,
    policyPath: "weekdays.blockedWeekdays",
    evaluate: weekdayRule,
  },
  {
    code: "FERIADO_BLOQUEADO",
    title: "Feriados e datas especiais",
    article: "Regulamento — Feriados (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ALL_BOOKING_ACTIONS,
    policyPath: "holidays.fixedDates",
    evaluate: holidayRule,
  },
  {
    code: "ANTECEDENCIA_MIN",
    title: "Antecedência mínima",
    article: "Regulamento — Antecedência (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ["CREATE", "QUEUE_JOIN"],
    policyPath: "booking.minAdvanceHours",
    evaluate: minAdvanceRule,
  },
  {
    code: "ANTECEDENCIA_MAX",
    title: "Antecedência máxima",
    article: "Regulamento — Antecedência (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ["CREATE", "QUEUE_JOIN"],
    policyPath: "booking.maxAdvanceDays",
    evaluate: maxAdvanceRule,
  },
  {
    code: "LIMITE_MENSAL",
    title: "Limite mensal por unidade",
    article: "Regulamento — Limites de uso (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ["CREATE", "QUEUE_JOIN"],
    policyPath: "quota.maxPerMonthPerUnit",
    evaluate: monthlyQuotaRule,
  },
  {
    code: "LIMITE_RESERVAS_ATIVAS",
    title: "Limite de reservas futuras ativas",
    article: "Regulamento — Limites de uso (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ["CREATE", "QUEUE_JOIN"],
    policyPath: "quota.maxActiveFuturePerUnit",
    evaluate: activeFutureQuotaRule,
  },
  {
    code: "FILA_CHEIA",
    title: "Limite da fila de espera",
    article: "Regulamento — Fila de espera (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ["QUEUE_JOIN"],
    policyPath: "quota.maxQueueSize",
    evaluate: queueLimitRule,
  },
  {
    code: "CAPACIDADE_EXCEDIDA",
    title: "Capacidade máxima da área",
    article: "Regulamento — Capacidade (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ["GUEST_LIST_EDIT", "CHECK_IN"],
    policyPath: "capacity.maxPeople",
    evaluate: capacityRule,
  },
  {
    code: "LISTA_CONVIDADOS_LIMITE",
    title: "Limite da lista de convidados",
    article: "Regulamento — Lista de convidados (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ["GUEST_LIST_EDIT"],
    policyPath: "capacity.guestList.maxGuests",
    evaluate: guestListLimitRule,
  },
  {
    code: "LISTA_CONVIDADOS_PRAZO",
    title: "Prazo da lista de convidados",
    article: "Regulamento — Lista de convidados (art. a mapear na D.6)",
    priority: "VALIDATION",
    appliesTo: ["GUEST_LIST_EDIT"],
    policyPath: "capacity.guestList.submitDeadlineHours",
    evaluate: guestListDeadlineRule,
  },
  {
    code: "CANCELAMENTO_TARDIO",
    title: "Janela mínima de cancelamento",
    article: "Regulamento — Cancelamento (art. 12)",
    priority: "VALIDATION",
    appliesTo: ["CANCEL"],
    policyPath: "cancellation.minHoursBeforeEvent",
    evaluate: cancellationWindowRule,
  },
  // ═══════════════════════════ D.11.5 — NOVOS RULE CODES ═══════════════════════
  {
    code: "CANCELAMENTO_MULTA",
    title: "Multa por cancelamento tardio",
    article: "Regulamento — Cancelamento (art. 14)",
    priority: "VALIDATION",
    appliesTo: ["CANCEL"],
    policyPath: "financial.lateCancelFeeCentavos",
    evaluate: lateCancelPenaltyRule,
  },
  {
    code: "LISTA_CONVIDADOS_OBRIGATORIA",
    title: "Lista de convidados obrigatória",
    article: "Regulamento — Convidados (art. 21)",
    priority: "VALIDATION",
    appliesTo: ["APPROVE"], // D.11.9.1: lista só existe após reserva — validar no APPROVE, não no CREATE
    policyPath: "capacity.guestList.required",
    evaluate: guestListRequiredRule,
  },
  {
    code: "LISTA_CONVIDADOS_BLOQUEIO",
    title: "Bloqueio da lista de convidados",
    article: "Regulamento — Convidados (art. 24)",
    priority: "BLOCKER",
    appliesTo: ["GUEST_LIST_EDIT"],
    policyPath: "capacity.guestList.lockAfterDeadline",
    evaluate: guestListLockRule,
  },
  {
    code: "CHECKIN_OBRIGATORIO",
    title: "Check-in obrigatório",
    article: "Regulamento — Portaria (art. 25)",
    priority: "VALIDATION",
    appliesTo: ["CHECK_IN"],
    policyPath: "checkin.required",
    evaluate: checkinRequiredRule,
  },
  {
    code: "NO_SHOW_PENALIDADE",
    title: "Penalidade por no-show",
    article: "Regulamento — Penalidades (art. 29)",
    priority: "VALIDATION",
    appliesTo: ["CREATE", "QUEUE_JOIN", "QUEUE_PROMOTE", "OFFER_ACCEPT"],
    policyPath: "cancellation.noShowPenaltyCentavos",
    evaluate: noShowPenaltyRule,
  },
  {
    code: "JANELA_HORARIA",
    title: "Janela horária da área",
    article: "Regulamento — Horários (art. 31)",
    priority: "VALIDATION",
    appliesTo: ["CREATE", "QUEUE_JOIN"],
    policyPath: null,
    evaluate: scheduleWindowRule,
  },
  {
    code: "DATA_BLOQUEADA_ADMIN",
    title: "Datas bloqueadas pela administração",
    article: "Regulamento — Administração (art. 36)",
    priority: "BLOCKER",
    appliesTo: ["CREATE", "QUEUE_JOIN", "QUEUE_PROMOTE", "OFFER_ACCEPT"],
    policyPath: "holidays.custom",
    evaluate: adminBlockedDateRule,
  },
  {
    code: "CAMPO_FORA_HORARIO",
    title: "Horário de funcionamento do Campo",
    article: "Regulamento — Campo (art. 40)",
    priority: "VALIDATION",
    appliesTo: ["CAMPO_REGISTRAR"],
    policyPath: "campo",
    evaluate: campoForaHorarioRule,
  },
  {
    code: "CAMPO_EXCLUSIVIDADE_DIA_INVALIDO",
    title: "Dia não permitido para exclusividade do Campo",
    article: "Regulamento — Campo (art. 41)",
    priority: "VALIDATION",
    appliesTo: ["CREATE", "QUEUE_JOIN"],
    policyPath: "campo.exclusividade.diasPermitidos",
    evaluate: campoExclusividadeDiaRule,
  },
  {
    code: "CAMPO_EXCLUSIVIDADE_SOBREPOSICAO",
    title: "Sobreposição com exclusividade do Campo",
    article: "Regulamento — Campo (art. 42)",
    priority: "VALIDATION",
    appliesTo: ["CAMPO_REGISTRAR"],
    policyPath: "campo.exclusividade",
    evaluate: campoExclusividadeSobreposicaoRule,
  },
  {
    code: "SALDO_CONVIDADOS_EXCEDIDO",
    title: "Saldo mensal de convidados excedido",
    article: "Regulamento — Convidados (art. 50)",
    priority: "BLOCKER",
    appliesTo: ["USO_COMUM_CONVIDADO_ADICIONAR"],
    policyPath: "convidados.saldoMensalPorUnidade",
    evaluate: saldoConvidadosRule,
  },
];

export function rulesForAction(action: ReservaAction): ReadonlyArray<RuleDescriptor> {
  return RULE_CATALOG.filter((r) => r.appliesTo.includes(action));
}

export function getRuleDescriptor(code: RuleCode): RuleDescriptor | undefined {
  return RULE_CATALOG.find((r) => r.code === code);
}
