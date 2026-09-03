/**
 * FASE E.2.2 — SERVIÇO DE RETIRADA SEGURA (QR + PIN + MANUAL).
 *
 * Lógica pura — zero dependência de Next.js ou React.
 * Testável sem infraestrutura HTTP.
 */

import { createHash, randomBytes } from "crypto";
import type {
  EncomendaStatus,
  WithdrawMethod,
  EncomendaEvent,
  EncomendaCanonica,
} from "./types";

// ═══════════════════════════ QR TOKEN ═══════════════════════════

export interface QRTokenResult {
  token: string;
  hash: string;
  expiresAt: Date;
  issuedAt: Date;
}

export function generateQRToken(ttlMinutes = 72 * 60): QRTokenResult {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token, "utf8").digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
  return { token, hash, expiresAt, issuedAt: now };
}

export function hashQRToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isQRExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export function isQRRevoked(revokedAt?: string | null): boolean {
  return !!revokedAt;
}

export function isQRUsed(qrUsed?: boolean): boolean {
  return qrUsed === true;
}

// ═══════════════════════════ PIN ═══════════════════════════

export function hashPin(pin: string): string {
  return createHash("sha256").update(pin, "utf8").digest("hex");
}

export function generatePin(length = 4): string {
  const digits = "0123456789";
  const buf = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += digits[buf[i] % 10];
  return out;
}

export function last4(pin: string): string {
  return pin.slice(-4);
}

/** Política de PIN: máximo de tentativas antes do bloqueio. */
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

export function isPinLocked(lockedUntil?: string | null): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

export function isPinExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// ═══════════════════════════ VALIDAÇÃO DE RETIRADA ═══════════════════════════

export type WithdrawValidation =
  | { valid: true; method: WithdrawMethod }
  | { valid: false; reason: string; code: string };

export function validateWithdrawByQR(
  canonical: EncomendaCanonica,
  qrTokenRaw: string,
): WithdrawValidation {
  if (canonical.audit.status !== "AGUARDANDO_RETIRADA") {
    return { valid: false, reason: "Encomenda não está aguardando retirada.", code: "STATUS_INVALID" };
  }
  if (!canonical.security.qrTokenHash) {
    return { valid: false, reason: "QR não emitido para esta encomenda.", code: "QR_NOT_ISSUED" };
  }
  const computedHash = hashQRToken(qrTokenRaw);
  if (computedHash !== canonical.security.qrTokenHash) {
    return { valid: false, reason: "QR token inválido.", code: "QR_INVALID" };
  }
  if (isQRExpired(canonical.security.qrExpiresAt)) {
    return { valid: false, reason: "QR expirado.", code: "QR_EXPIRED" };
  }
  if (isQRUsed(canonical.security.qrUsed)) {
    return { valid: false, reason: "QR já foi utilizado.", code: "QR_ALREADY_USED" };
  }
  return { valid: true, method: "QR_CODE" };
}

export function validateWithdrawByPIN(
  canonical: EncomendaCanonica,
  pinRaw: string,
): WithdrawValidation {
  if (canonical.audit.status !== "AGUARDANDO_RETIRADA") {
    return { valid: false, reason: "Encomenda não está aguardando retirada.", code: "STATUS_INVALID" };
  }
  if (!canonical.security.pinHash) {
    return { valid: false, reason: "PIN não configurado.", code: "PIN_NOT_SET" };
  }
  if (isPinLocked(canonical.security.pinLockedUntil)) {
    return { valid: false, reason: "PIN bloqueado por excesso de tentativas.", code: "PIN_LOCKED" };
  }
  if (isPinExpired(canonical.security.pinExpiresAt)) {
    return { valid: false, reason: "PIN expirado.", code: "PIN_EXPIRED" };
  }
  const computedHash = hashPin(pinRaw);
  if (computedHash !== canonical.security.pinHash) {
    return { valid: false, reason: "PIN incorreto.", code: "PIN_INVALID" };
  }
  return { valid: true, method: "PIN" };
}

// ═══════════════════════════ EVENTOS ═══════════════════════════

/**
 * ENCOMENDAS.2F — allowlist de chaves de metadata permitidas em um evento
 * de auditoria. Qualquer chave fora desta lista é descartada, mesmo que
 * inofensiva — o modelo de segurança é "só o que está explicitamente
 * permitido entra", não "bloquear o que é conhecido como perigoso".
 */
// ENCOMENDAS.2G-FIX.1: "lote" removido — não é uma referência inócua, é o
// próprio token portador (bearer) usado para autorizar retirada/confirmação
// em lote (mesmo valor do ID do documento retiradas_lote/{token}). Persistir
// isso em metadata de evento gravava a credencial viva em um registro
// durável, depois exposto pela API de auditoria (2F). Nenhum identificador
// não-secreto equivalente existe hoje — omitir a referência de lote do
// evento é a correção mínima, em vez de trocá-la por um hash (um segredo de
// baixa entropia continua enumerável offline mesmo com hash).
export const SAFE_EVENT_METADATA_KEYS = [
  "method",
  "encomendaId",
  "condominioId",
  "scannerSource",
  "attempt",
  "lockedUntil",
  "reason",
] as const;

function buildSafeEventMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata) return {};
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_EVENT_METADATA_KEYS) {
    if (metadata[key] !== undefined) {
      safe[key] = metadata[key];
    }
  }
  return safe;
}

export function createWithdrawEvent(
  type: EncomendaEvent["type"],
  actorUid?: string | null,
  actorRole?: string | null,
  actorName?: string | null,
  metadata?: Record<string, unknown>,
): EncomendaEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    actorUid: actorUid ?? null,
    actorRole: actorRole ?? null,
    actorName: actorName ?? null,
    metadata: buildSafeEventMetadata(metadata),
  };
}

// ═══════════════════════════ NORMALIZAÇÃO ═══════════════════════════

export function normalizeCode(raw: string): string {
  return raw.replace(/[^A-Z0-9]/gi, "").toUpperCase().trim();
}
