/**
 * REGRA: OFERTA_EXPIRADA (BLOCKER)
 *
 * Paridade: reservasOfertaPrazo.ts:3-23 (isOfferExpired) usada por
 * fila/aceitar:129-132, fila-assumir:200-203 e reservasOfertaExpirada.ts:104.
 * Semântica homologada: oferta sem prazo registrado (null) NÃO está expirada.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "OFERTA_EXPIRADA" as const;
const PRIORITY = "BLOCKER" as const;

export const offerExpiryRule: RuleEvaluator = (policy, ctx) => {
  const duration = policy.policy.queue.offerDurationMinutes;
  if (!ctx.offer) {
    return skip(CODE, PRIORITY, "Sem oferta no contexto — regra não se aplica.", duration);
  }
  const expiresAtMs = ctx.offer.expiresAtMs;
  if (expiresAtMs == null || !Number.isFinite(expiresAtMs)) {
    return pass(CODE, PRIORITY, "Oferta sem prazo registrado — não expirada (comportamento homologado).", duration);
  }
  if (ctx.nowMs > expiresAtMs) {
    return fail(CODE, PRIORITY, "Oferta expirada.", duration, {
      expirouEmISO: new Date(expiresAtMs).toISOString(),
    });
  }
  return pass(CODE, PRIORITY, "Oferta dentro do prazo.", duration);
};
