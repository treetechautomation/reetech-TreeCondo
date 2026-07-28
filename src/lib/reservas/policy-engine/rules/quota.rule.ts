/**
 * REGRA: FILA_CHEIA / LIMITE_MENSAL / LIMITE_RESERVAS_ATIVAS (VALIDATION).
 *
 * D.11.8: FactState efetivo — cotas com estado UNKNOWN ou ERROR não liberam
 * a ação; o sistema bloqueia por segurança (fail-closed).
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const PRIORITY = "VALIDATION" as const;

export const queueLimitRule: RuleEvaluator = (policy, ctx) => {
  const max = policy.policy.quota.maxQueueSize;
  if (ctx.quota.queueSizeForSlot >= max) {
    return fail("FILA_CHEIA", PRIORITY, `Fila cheia (limite de ${max}).`, max, {
      filaCount: ctx.quota.queueSizeForSlot,
    });
  }
  return pass("FILA_CHEIA", PRIORITY, "Há vaga na fila de espera.", max);
};

export const monthlyQuotaRule: RuleEvaluator = (policy, ctx) => {
  const max = policy.policy.quota.maxPerMonthPerUnit;
  if (max == null) {
    return skip("LIMITE_MENSAL", PRIORITY, "Sem limite mensal configurado.", null);
  }

  const state = ctx.quota.monthCountState ?? "KNOWN";
  if (state === "ERROR") {
    return fail("LIMITE_MENSAL", PRIORITY,
      "Erro ao consultar cota mensal — bloqueio preventivo.", max,
      { error: true, state: "ERROR" });
  }
  if (state === "UNKNOWN") {
    return fail("LIMITE_MENSAL", PRIORITY,
      "Cota mensal indisponível (unidade não identificada) — bloqueio preventivo.", max,
      { state: "UNKNOWN" });
  }

  if (ctx.quota.monthCountForUnit >= max) {
    return fail("LIMITE_MENSAL", PRIORITY, `Limite mensal de ${max} reserva(s) por unidade atingido.`, max, {
      reservasNoMes: ctx.quota.monthCountForUnit,
    });
  }
  return pass("LIMITE_MENSAL", PRIORITY, "Dentro do limite mensal.", max);
};

export const activeFutureQuotaRule: RuleEvaluator = (policy, ctx) => {
  const max = policy.policy.quota.maxActiveFuturePerUnit;
  if (max == null) {
    return skip("LIMITE_RESERVAS_ATIVAS", PRIORITY, "Sem limite de reservas futuras configurado.", null);
  }

  const state = ctx.quota.activeFutureState ?? "KNOWN";
  if (state === "ERROR") {
    return fail("LIMITE_RESERVAS_ATIVAS", PRIORITY,
      "Erro ao consultar reservas futuras — bloqueio preventivo.", max,
      { error: true, state: "ERROR" });
  }
  if (state === "UNKNOWN") {
    return fail("LIMITE_RESERVAS_ATIVAS", PRIORITY,
      "Reservas futuras indisponíveis (unidade não identificada) — bloqueio preventivo.", max,
      { state: "UNKNOWN" });
  }

  if (ctx.quota.activeFutureForUnit >= max) {
    return fail("LIMITE_RESERVAS_ATIVAS", PRIORITY,
      `Limite de ${max} reserva(s) futura(s) ativa(s) por unidade atingido.`, max,
      { reservasAtivas: ctx.quota.activeFutureForUnit });
  }
  return pass("LIMITE_RESERVAS_ATIVAS", PRIORITY, "Dentro do limite de reservas ativas.", max);
};
