/**
 * FASE E.2.0 — MODELO CANÔNICO DO MÓDULO DE ENCOMENDAS.
 *
 * Domínios separados conceitualmente:
 *   - PackageData       → dados da encomenda física
 *   - RecipientData     → destinatário (unidade/morador)
 *   - RegistrationData  → quem registrou (porteiro)
 *   - WithdrawalData    → retirada (método, PIN, QR, auditoria)
 *   - AuditData         → timestamps de ciclo de vida
 *   - SecurityData      → segredos (hash, token) — NUNCA plaintext
 *
 * Compatibilidade: encomendas legadas continuam legíveis.
 * Campos removidos: codigoRetirada (plaintext) — apenas hash permanece.
 */

// ═══════════════════════════ MÉTODOS DE RETIRADA ═══════════════════════════

export type WithdrawMethod = "QR_CODE" | "PIN" | "PORTEIRO" | "ARMARIO_INTELIGENTE";

// ═══════════════════════════ STATUS DA ENCOMENDA ═══════════════════════════

export type EncomendaStatus =
  | "CHEGOU"
  | "AGUARDANDO_RETIRADA"
  | "RETIRADA"
  | "CANCELADA"
  | "DEVOLVIDA"
  | "EXTRAVIADA";

/** Transições válidas entre status. */
export const ENCOMENDA_TRANSITIONS: Record<EncomendaStatus, EncomendaStatus[]> = {
  CHEGOU:               ["AGUARDANDO_RETIRADA", "CANCELADA"],
  AGUARDANDO_RETIRADA:  ["RETIRADA", "CANCELADA", "DEVOLVIDA"],
  RETIRADA:             [],
  CANCELADA:            [],
  DEVOLVIDA:            ["AGUARDANDO_RETIRADA"],
  EXTRAVIADA:           [],
};

// ═══════════════════════════ DADOS DA ENCOMENDA ═══════════════════════════

export interface PackageData {
  /** Código lido pelo scanner (código de barras, QR, rastreamento). */
  codigo: string;
  /** Tipo do código: EAN13, CODE128, QR, etc. */
  codigoTipo?: string | null;
  /** Transportadora (Correios, Jadlog, etc.) */
  transportadora?: string | null;
  /** Número da nota fiscal. */
  nfNumero?: string | null;
  /** Observações livres. */
  observacoes?: string | null;
  /** URL da foto da encomenda (Storage). */
  fotoUrl?: string | null;
}

export interface RecipientData {
  unidadeId: string;
  unidadeIdNorm: string;
  blocoId?: string | null;
  blocoIdNorm?: string | null;
  /** Nome do destinatário (detectado via OCR ou informado manualmente). */
  destinatarioNome?: string | null;
}

export interface RegistrationData {
  registradoPorUid: string;
  registradoPorNome?: string | null;
  registradoPorEmail?: string | null;
  registradoPorRole?: string | null;
}

// ═══════════════════════════ DADOS DE RETIRADA ═══════════════════════════

export interface WithdrawalData {
  /** Método utilizado na retirada. */
  withdrawMethod?: WithdrawMethod | null;
  /** Timestamp da retirada. */
  retiradaEm?: string | null;
  /** UID de quem retirou (porteiro que executou a retirada). */
  retiradoPorUid?: string | null;
  /** Nome de quem retirou. */
  retiradoPorNome?: string | null;
  /** URL da assinatura digital. */
  assinaturaUrl?: string | null;
  /** URL da foto no momento da retirada. */
  fotoRetiradaUrl?: string | null;
}

// ═══════════════════════════ SEGURANÇA (NUNCA PLAINTEXT) ═════════════════

export interface SecurityData {
  /** Hash SHA-256 do PIN de retirada. NUNCA o PIN em plaintext. */
  pinHash: string | null;
  /** Últimos 4 caracteres do PIN (para exibição: "**92"). */
  pinLast4: string | null;
  /** Expiração do PIN atual. */
  pinExpiresAt?: string | null;
  /** Contagem de tentativas de PIN incorretas. */
  pinAttempts?: number;
  /** Bloqueio temporário após exceder tentativas. */
  pinLockedUntil?: string | null;
  /** Token opaco para QR Code de retirada. */
  qrToken?: string | null;
  /** Hash do qrToken (validação server-side). */
  qrTokenHash?: string | null;
  /** Expiração do QR token. */
  qrExpiresAt?: string | null;
  /** Se true, QR já foi usado (uso único). */
  qrUsed?: boolean;
}

// ═══════════════════════════ DADOS DE AUDITORIA ═══════════════════════════

export interface AuditData {
  status: EncomendaStatus;
  chegouEm?: string | null;
  criadoEm?: string | null;
  updatedAt?: string | null;
  canceladoPorUid?: string | null;
  canceladoEm?: string | null;
  devolvidoEm?: string | null;
  extraviadoEm?: string | null;
}

// ═══════════════════════════ DOCUMENTO CANÔNICO ═══════════════════════════

export interface EncomendaCanonica {
  /** ID do documento Firestore. */
  id: string;
  condominioId: string;
  package: PackageData;
  recipient: RecipientData;
  registration: RegistrationData;
  withdrawal: WithdrawalData;
  security: SecurityData;
  audit: AuditData;
}

// ═══════════════════════════ EVENTO DE AUDITORIA ═══════════════════════════

export type EncomendaEventType =
  | "REGISTERED"
  | "SCANNED"
  | "PHOTO_ADDED"
  | "NOTIFIED"
  | "QR_ISSUED"
  | "PIN_ISSUED"
  | "WITHDRAWAL_REQUESTED"
  | "WITHDRAWN"
  | "RETURNED"
  | "CANCELLED"
  | "LOST";

export interface EncomendaEvent {
  type: EncomendaEventType;
  timestamp: string;
  actorUid?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  /** Metadados auxiliares — NUNCA armazenar segredo aqui. */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════ SCANNER ═══════════════════════════

export type ScannerSource = "USB_HID" | "BLUETOOTH_HID" | "CAMERA" | "MANUAL";

export interface ScanResult {
  code: string;
  source: ScannerSource;
  codeType?: string;
  scannedAt: string;
}

// ═══════════════════════════ QR TOKEN ═══════════════════════════

export interface QRTokenPayload {
  /** Token opaco aleatório. */
  token: string;
  encomendaId: string;
  condominioId: string;
  expiresAt: string;
  issuedAt: string;
}

// ═══════════════════════════ HELPERS ═══════════════════════════

import { createHash, randomBytes } from "crypto";

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

export function generateQRToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashQRToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeCode(raw: string): string {
  return raw.replace(/[^A-Z0-9]/gi, "").toUpperCase().trim();
}

/** Verifica se o status de destino é uma transição válida. */
export function isValidTransition(
  current: EncomendaStatus,
  next: EncomendaStatus,
): boolean {
  return ENCOMENDA_TRANSITIONS[current]?.includes(next) ?? false;
}

// ═══════════════════════════ COMPATIBILIDADE LEGADA ═══════════════════════

/**
 * Mapeia um documento Firestore legado para o modelo canônico.
 * Campos ausentes recebem defaults seguros.
 */
export function mapLegacyToCanonica(doc: Record<string, unknown>, id: string): EncomendaCanonica {
  return {
    id,
    condominioId: String(doc.condominioId ?? ""),
    package: {
      codigo: String(doc.codigo ?? ""),
      codigoTipo: doc.codigoTipo ? String(doc.codigoTipo) : null,
      transportadora: doc.transportadora ? String(doc.transportadora) : null,
      nfNumero: doc.nfNumero ? String(doc.nfNumero) : null,
      observacoes: doc.observacoes ? String(doc.observacoes) : null,
      fotoUrl: doc.fotoUrl ? String(doc.fotoUrl) : null,
    },
    recipient: {
      unidadeId: String(doc.unidadeId ?? ""),
      unidadeIdNorm: String(doc.unidadeIdNorm ?? ""),
      blocoId: doc.blocoId ? String(doc.blocoId) : null,
      blocoIdNorm: doc.blocoIdNorm ? String(doc.blocoIdNorm) : null,
      destinatarioNome: null,
    },
    registration: {
      registradoPorUid: String(doc.registradoPorUid ?? doc.criadoPorUid ?? ""),
      registradoPorNome: doc.registradoPorNome || doc.criadoPorNome ? String(doc.registradoPorNome ?? doc.criadoPorNome) : null,
      registradoPorEmail: doc.registradoPorEmail || doc.criadoPorEmail ? String(doc.registradoPorEmail ?? doc.criadoPorEmail) : null,
      registradoPorRole: doc.registradoPorRole ? String(doc.registradoPorRole) : null,
    },
    withdrawal: {
      withdrawMethod: doc.withdrawMethod ? String(doc.withdrawMethod) as WithdrawMethod : null,
      retiradaEm: doc.retiradaEm ? String(doc.retiradaEm) : null,
      retiradoPorUid: doc.retiradoPorUid ? String(doc.retiradoPorUid) : null,
      retiradoPorNome: doc.retiradoPorNome ? String(doc.retiradoPorNome) : null,
      assinaturaUrl: null,
      fotoRetiradaUrl: null,
    },
    security: {
      pinHash: (doc.codigoRetiradaHash || doc.pinHash) ? String(doc.codigoRetiradaHash ?? doc.pinHash) : null,
      pinLast4: (doc.codigoRetiradaLast4 || doc.pinLast4) ? String(doc.codigoRetiradaLast4 ?? doc.pinLast4) : null,
      pinExpiresAt: null,
      pinAttempts: 0,
      pinLockedUntil: null,
      qrToken: null,
      qrTokenHash: null,
      qrExpiresAt: null,
      qrUsed: false,
    },
    audit: {
      status: (String(doc.status || "CHEGOU")) as EncomendaStatus,
      chegouEm: doc.chegouEm ? String(doc.chegouEm) : null,
      criadoEm: doc.createdAt ? String(doc.createdAt) : null,
      updatedAt: doc.updatedAt ? String(doc.updatedAt) : null,
      canceladoPorUid: null,
      canceladoEm: null,
      devolvidoEm: null,
      extraviadoEm: null,
    },
  };
}
