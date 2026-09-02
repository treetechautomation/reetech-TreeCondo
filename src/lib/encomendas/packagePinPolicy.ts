/**
 * ENCOMENDAS.2D — política de segurança do PIN por encomenda
 * (expiração, tentativas, bloqueio temporário).
 *
 * Lógica pura — zero dependência de Firestore/Next.js. O chamador é
 * responsável por ler o documento fresco DENTRO de uma transação, aplicar
 * a `mutation` retornada com o mesmo `tx.update`, e nunca lançar exceção
 * dentro da transação apenas por causa de PIN incorreto — do contrário a
 * mutação de tentativa seria revertida (Firestore reverte writes quando o
 * callback da transação lança).
 */

import { hashPin, PIN_MAX_ATTEMPTS, PIN_LOCK_DURATION_MS } from "./withdrawal";

export { PIN_MAX_ATTEMPTS, PIN_LOCK_DURATION_MS };

export type PackagePinOutcome =
  | { code: "SUCCESS" }
  | { code: "PIN_INVALID"; attempt: number; locked: boolean; lockedUntil: string | null }
  | { code: "PIN_LOCKED"; lockedUntil: string }
  | { code: "PIN_EXPIRED" }
  | { code: "CREDENTIAL_NOT_CONFIGURED" }
  | { code: "PACKAGE_ALREADY_WITHDRAWN" }
  | { code: "STATUS_INVALID" };

export interface PackagePinSnapshot {
  status?: string | null;
  pinHash?: string | null;
  pinExpiresAt?: string | null;
  pinAttempts?: number | null;
  pinLockedUntil?: string | null;
}

export interface PackagePinEvaluation {
  outcome: PackagePinOutcome;
  /** Campos a escrever via tx.update(ref, mutation). null = nenhuma escrita necessária. */
  mutation: Record<string, unknown> | null;
}

/**
 * Falha fechado: sem pinExpiresAt, a credencial é tratada como expirada
 * (nunca como "sem expiração"). Mantido separado de isPinExpired() em
 * withdrawal.ts, que é fail-open (usado pelo QR, onde ausência de prazo é
 * uma condição legítima e não deve ser copiada aqui).
 */
function isPackagePinExpired(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt) <= now;
}

export function evaluatePackagePinAttempt(
  data: PackagePinSnapshot,
  pinRaw: string,
  now: Date = new Date(),
): PackagePinEvaluation {
  const status = String(data.status || "").toUpperCase();

  if (status === "RETIRADA") {
    return { outcome: { code: "PACKAGE_ALREADY_WITHDRAWN" }, mutation: null };
  }
  if (status !== "AGUARDANDO") {
    return { outcome: { code: "STATUS_INVALID" }, mutation: null };
  }
  if (!data.pinHash) {
    return { outcome: { code: "CREDENTIAL_NOT_CONFIGURED" }, mutation: null };
  }
  if (isPackagePinExpired(data.pinExpiresAt, now)) {
    return { outcome: { code: "PIN_EXPIRED" }, mutation: null };
  }

  // Bloqueio: ativo rejeita sem incrementar; expirado reseta o ciclo antes
  // de avaliar esta tentativa (baseline volta a 0).
  let baselineAttempts = Number(data.pinAttempts) || 0;
  let lockWasReset = false;
  if (data.pinLockedUntil) {
    const lockedUntilDate = new Date(data.pinLockedUntil);
    if (lockedUntilDate > now) {
      return { outcome: { code: "PIN_LOCKED", lockedUntil: data.pinLockedUntil }, mutation: null };
    }
    baselineAttempts = 0;
    lockWasReset = true;
  }

  const computedHash = hashPin(pinRaw);
  if (computedHash === data.pinHash) {
    const mutation = lockWasReset ? { pinAttempts: 0, pinLockedUntil: null } : null;
    return { outcome: { code: "SUCCESS" }, mutation };
  }

  const attempt = baselineAttempts + 1;
  const locked = attempt >= PIN_MAX_ATTEMPTS;
  const lockedUntil = locked ? new Date(now.getTime() + PIN_LOCK_DURATION_MS).toISOString() : null;

  return {
    outcome: { code: "PIN_INVALID", attempt, locked, lockedUntil },
    mutation: { pinAttempts: attempt, pinLockedUntil: lockedUntil },
  };
}
