/**
 * ACCESS.3 — ESTADOS DERIVADOS (nunca persistidos).
 *
 * EXPIRADO (autorização) e EXIT_OVERDUE (permanência) são computáveis a
 * partir de campos já armazenados + relógio atual — ACCESS.2 recomendou
 * tratá-los assim para evitar um scheduler ter que "promover" um
 * documento só para refletir a passagem do tempo. Este módulo é a
 * fonte única dessa derivação; UI/API devem chamar estas funções em vez
 * de reimplementar a comparação de datas.
 */

import type { AccessAuthorization, AccessStay } from "./types";

/** Estado efetivo de exibição de uma autorização — nunca escrito no documento. */
export type EffectiveAuthorizationStatus = "AUTORIZADO" | "REVOGADO" | "EXPIRADO";

export function deriveAuthorizationStatus(
  authorization: Pick<AccessAuthorization, "status" | "newEntryValidUntil">,
  now: Date = new Date(),
): EffectiveAuthorizationStatus {
  if (authorization.status === "REVOGADO") return "REVOGADO";
  if (now.getTime() > authorization.newEntryValidUntil.getTime()) return "EXPIRADO";
  return "AUTORIZADO";
}

/** Estado efetivo de exibição de uma permanência ATIVA — nunca escrito no documento (AUTO_CLOSED/CLOSED continuam sendo o `workflowState` real, não derivados). */
export type EffectiveWorkflowState = "ACTIVE" | "EXIT_OVERDUE" | "AUTO_CLOSED" | "CLOSED";

export function deriveWorkflowState(
  stay: Pick<AccessStay, "workflowState" | "enteredAt">,
  pendingExitAfterMinutes: number,
  now: Date = new Date(),
): EffectiveWorkflowState {
  if (stay.workflowState !== "ACTIVE") return stay.workflowState;
  const overdueAt = stay.enteredAt.getTime() + pendingExitAfterMinutes * 60_000;
  return now.getTime() > overdueAt ? "EXIT_OVERDUE" : "ACTIVE";
}

/** Determina se uma permanência ACTIVE já ultrapassou o limiar de auto-close (para o job de reconciliação futuro, ACCESS.7). */
export function isPastAutoCloseThreshold(
  stay: Pick<AccessStay, "workflowState" | "enteredAt">,
  autoCloseAfterMinutes: number,
  now: Date = new Date(),
): boolean {
  if (stay.workflowState !== "ACTIVE") return false;
  const thresholdAt = stay.enteredAt.getTime() + autoCloseAfterMinutes * 60_000;
  return now.getTime() > thresholdAt;
}
