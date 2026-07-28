/**
 * REGRA: CAPACIDADE_EXCEDIDA / LISTA_CONVIDADOS_LIMITE / LISTA_CONVIDADOS_PRAZO
 * (VALIDATION)
 *
 * Hoje o motor congelado registra capacidadeMax na reserva mas NÃO valida a
 * lista de convidados contra política (fluxo de check-in é livre). A política
 * default preserva isso (guestList.required=false, maxGuests=null,
 * submitDeadlineHours=0) ⇒ SKIP na v0. Pronta para o regulamento (D.6).
 */

import type { RuleEvaluator } from "../types";
import { fail, hoursUntilEvent, pass, skip } from "./_shared";

const PRIORITY = "VALIDATION" as const;

export const capacityRule: RuleEvaluator = (policy, ctx) => {
  const max = policy.policy.capacity.maxPeople;
  if (max == null || ctx.guestCount == null) {
    return skip("CAPACIDADE_EXCEDIDA", PRIORITY, "Sem capacidade máxima aplicável.", max ?? null);
  }
  if (ctx.guestCount > max) {
    return fail("CAPACIDADE_EXCEDIDA", PRIORITY, `Capacidade máxima de ${max} pessoas excedida.`, max, {
      convidados: ctx.guestCount,
    });
  }
  return pass("CAPACIDADE_EXCEDIDA", PRIORITY, "Dentro da capacidade máxima.", max);
};

export const guestListLimitRule: RuleEvaluator = (policy, ctx) => {
  const g = policy.policy.capacity.guestList;
  if (g.maxGuests == null || ctx.guestCount == null) {
    return skip("LISTA_CONVIDADOS_LIMITE", PRIORITY, "Sem limite de convidados aplicável.", g.maxGuests ?? null);
  }
  if (ctx.guestCount > g.maxGuests) {
    return fail(
      "LISTA_CONVIDADOS_LIMITE",
      PRIORITY,
      `Lista de convidados limitada a ${g.maxGuests}.`,
      g.maxGuests,
      { convidados: ctx.guestCount }
    );
  }
  return pass("LISTA_CONVIDADOS_LIMITE", PRIORITY, "Lista dentro do limite.", g.maxGuests);
};

export const guestListDeadlineRule: RuleEvaluator = (policy, ctx) => {
  const g = policy.policy.capacity.guestList;
  if (!g.lockAfterDeadline || g.submitDeadlineHours <= 0) {
    return skip("LISTA_CONVIDADOS_PRAZO", PRIORITY, "Sem prazo de lista configurado.", g.submitDeadlineHours);
  }
  const hrs = hoursUntilEvent(ctx.dateStr, ctx.nowMs);
  if (hrs < g.submitDeadlineHours) {
    return fail(
      "LISTA_CONVIDADOS_PRAZO",
      PRIORITY,
      `Lista de convidados encerrada (${g.submitDeadlineHours}h antes do evento).`,
      g.submitDeadlineHours,
      { horasAteEvento: Math.floor(hrs) }
    );
  }
  return pass("LISTA_CONVIDADOS_PRAZO", PRIORITY, "Dentro do prazo da lista.", g.submitDeadlineHours);
};
