/**
 * ACCESS.3 — SEPARAÇÃO FORMAL ENTRE PRESENÇA FÍSICA E WORKFLOW.
 *
 * Correção 1.1 do arquiteto: AUTO_CLOSED nunca significa que a pessoa
 * saiu. Este módulo formaliza essa invariante como predicados puros,
 * testáveis, para que nenhum código futuro precise reimplementar (ou
 * errar) essa lógica.
 */

import type { AccessStay } from "./types";

/**
 * Verdadeiro quando não existe saída física confirmada para esta
 * permanência — independente de `workflowState`. Esta é a fonte de
 * verdade para "pessoas sem saída confirmada" (correção 1.1-A do
 * arquiteto); NUNCA usar `workflowState` sozinho para inferir presença
 * física.
 */
export function hasUnconfirmedPhysicalExit(
  stay: Pick<AccessStay, "physicalPresenceState" | "exitConfirmedAt">,
): boolean {
  return stay.physicalPresenceState === "INSIDE" && stay.exitConfirmedAt === null;
}

/**
 * Verdadeiro quando a permanência foi fechada operacionalmente (higiene
 * de workflow) MAS ainda não existe confirmação física de saída —
 * exatamente o estado que a correção 1.1-B do arquiteto pede para
 * distinguir como "pendência operacional", separado de "pessoas sem
 * saída confirmada" em geral (que também inclui ACTIVE sem saída).
 */
export function isAutoClosedWithoutConfirmedExit(
  stay: Pick<AccessStay, "workflowState" | "physicalPresenceState" | "exitConfirmedAt">,
): boolean {
  return stay.workflowState === "AUTO_CLOSED" && hasUnconfirmedPhysicalExit(stay);
}

/**
 * Contador de "pessoas no condomínio" (ACCESS.2 §27): conta permanências
 * sem saída física confirmada, SEJA qual for o workflowState. Uma
 * permanência AUTO_CLOSED sem saída confirmada continua contando como
 * fisicamente presente — o sistema nunca deve mentir sobre presença
 * apenas porque o workflow "arquivou" a linha da lista operacional
 * principal (correção 1.1 do arquiteto).
 */
export function countsAsPhysicallyPresent(
  stay: Pick<AccessStay, "physicalPresenceState" | "exitConfirmedAt">,
): boolean {
  return hasUnconfirmedPhysicalExit(stay);
}

/**
 * Aplica uma saída real (a qualquer momento, inclusive após
 * AUTO_CLOSED — "late real exit", ACCESS.2 §20/24). Retorna o patch a
 * ser aplicado; NÃO toca Firestore.
 *
 * Preserva `autoClosedAt`/`autoCloseReason` inalterados — os três fatos
 * (entrada, auto-close, saída real) coexistem permanentemente (ACCESS.2
 * invariante equivalente, formalizada aqui como invariante #11).
 */
export function applyConfirmedExit(
  stay: AccessStay,
  params: { exitConfirmedAt: Date; exitConfirmedByUid: string; exitCredentialMethod: AccessStay["exitCredentialMethod"] },
): Pick<AccessStay, "physicalPresenceState" | "workflowState" | "exitConfirmedAt" | "exitConfirmedByUid" | "exitCredentialMethod"> {
  return {
    physicalPresenceState: "EXIT_CONFIRMED",
    workflowState: "CLOSED",
    exitConfirmedAt: params.exitConfirmedAt,
    exitConfirmedByUid: params.exitConfirmedByUid,
    exitCredentialMethod: params.exitCredentialMethod,
  };
}
