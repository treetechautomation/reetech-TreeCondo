/**
 * REGRA: QUITACAO_PENDENTE (BLOCKER) / SUSPENSO_NO_SHOW (BLOCKER)
 *
 * Hoje o motor congelado NÃO verifica quitação nem suspensão por no-show.
 * A política default preserva isso (requiresPaidUpMember=false,
 * noShowTrackingEnabled=false) ⇒ SKIP na v0. Prontas para o regulamento (D.6).
 *
 * Exemplo do ajuste D.3 §3: inadimplente ⇒ BLOCKER ⇒ validator interrompe.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const PRIORITY = "BLOCKER" as const;

export const paidUpMemberRule: RuleEvaluator = (policy, ctx) => {
  if (!policy.policy.financial.requiresPaidUpMember) {
    return skip("QUITACAO_PENDENTE", PRIORITY, "Política não exige quitação.", false);
  }
  // D.11.9: fail-safe — null (UNKNOWN/ERROR) não autoriza decisão positiva.
  if (ctx.actor.isPaidUp === null) {
    return fail("QUITACAO_PENDENTE", PRIORITY,
      "Situação financeira indisponível — bloqueio preventivo.", null, {
      uid: ctx.actor.uid, reason: "isPaidUp is null",
    });
  }
  if (ctx.actor.isPaidUp === false) {
    return fail("QUITACAO_PENDENTE", PRIORITY, "Reserva bloqueada: existem débitos pendentes.", true, {
      uid: ctx.actor.uid,
    });
  }
  return pass("QUITACAO_PENDENTE", PRIORITY, "Morador adimplente.", true);
};

export const noShowSuspensionRule: RuleEvaluator = (policy, ctx) => {
  const c = policy.policy.cancellation;
  if (!c.noShowTrackingEnabled || c.noShowSuspensionDays == null) {
    return skip("SUSPENSO_NO_SHOW", PRIORITY, "Rastreio de no-show desabilitado.", false);
  }
  const until = ctx.actor.suspendedUntil;
  if (until && ctx.today <= until) {
    return fail(
      "SUSPENSO_NO_SHOW",
      PRIORITY,
      `Reservas suspensas por no-show até ${until}.`,
      c.noShowSuspensionDays,
      { suspensoAte: until }
    );
  }
  return pass("SUSPENSO_NO_SHOW", PRIORITY, "Sem suspensão vigente.", c.noShowSuspensionDays);
};
