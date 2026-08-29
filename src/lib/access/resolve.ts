/**
 * ACCESS.3 — DECISÃO PURA DE RESOLUÇÃO DE CREDENCIAL.
 *
 * Sem Firestore, sem mutação, sem API — ACCESS.6 (Portaria Resolve)
 * chamará esta função depois de já ter carregado a autorização e a
 * eventual permanência aberta. Resolver uma credencial NUNCA registra
 * entrada/saída (invariante #2 do ACCESS.2) — apenas decide qual ação
 * oferecer para confirmação explícita do operador.
 */

import type { AccessAuthorization, AccessStay } from "./types";

export type AccessAction = "OFFER_ENTRY" | "OFFER_EXIT" | "DENY";

export const ACCESS_DENY_REASONS = [
  "NOT_FOUND",
  "NOT_STARTED",
  "EXPIRED",
  "REVOKED",
  "ALREADY_USED",
  "OUTSIDE_ALLOWED_WINDOW",
  "CONDOMINIUM_MISMATCH",
  "MEMBER_INACTIVE",
  "PIN_LOCKED",
  "INVALID_CREDENTIAL",
] as const;
export type AccessDenyReason = (typeof ACCESS_DENY_REASONS)[number];

export type AccessResolution =
  | { action: "OFFER_ENTRY"; authorization: AccessAuthorization }
  | { action: "OFFER_EXIT"; authorization: AccessAuthorization; stay: AccessStay }
  | { action: "DENY"; reason: AccessDenyReason };

/**
 * `openStay`, se fornecida, deve já ter sido carregada pelo chamador via
 * `accessStays/{authorization.id}` (ID determinístico — ver types.ts) —
 * esta função não faz nenhuma consulta.
 *
 * Regras (ACCESS.2 §19/ACCESS.3 §34, tabela de casos congelada pelo
 * arquiteto):
 *   - existe permanência aberta -> OFFER_EXIT, INDEPENDENTE do estado da
 *     autorização (expirada ou revogada não bloqueiam saída — invariante
 *     #4: a permanência física precisa poder ser encerrada mesmo depois
 *     que a janela de nova entrada fechou ou a autorização foi revogada).
 *   - sem permanência aberta:
 *       REVOGADO -> DENY (REVOKED)
 *       fora da janela de nova entrada -> DENY (EXPIRED)
 *       SINGLE_USE com stay(s) anterior(es) já fechada(s) -> DENY (ALREADY_USED)
 *       caso contrário -> OFFER_ENTRY
 */
export function resolveAccessAction(params: {
  authorization: AccessAuthorization | null;
  openStay: AccessStay | null;
  /** Sob SINGLE_USE, indica se já existe QUALQUER stay (aberta ou fechada) para esta autorização — usado apenas quando não há stay aberta. */
  hasAnyPriorStay: boolean;
  now?: Date;
}): AccessResolution {
  const { authorization, openStay, hasAnyPriorStay } = params;
  const now = params.now ?? new Date();

  if (!authorization) return { action: "DENY", reason: "NOT_FOUND" };

  if (openStay) {
    // A permanência aberta sempre pode ser encerrada, mesmo com
    // autorização revogada/expirada (invariante #4).
    return { action: "OFFER_EXIT", authorization, stay: openStay };
  }

  if (authorization.status === "REVOGADO") {
    return { action: "DENY", reason: "REVOKED" };
  }

  const withinWindow =
    now.getTime() >= authorization.newEntryValidFrom.getTime() &&
    now.getTime() <= authorization.newEntryValidUntil.getTime();
  if (!withinWindow) {
    return { action: "DENY", reason: "EXPIRED" };
  }

  if (authorization.usagePolicy === "SINGLE_USE" && hasAnyPriorStay) {
    return { action: "DENY", reason: "ALREADY_USED" };
  }

  return { action: "OFFER_ENTRY", authorization };
}
