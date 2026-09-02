/**
 * FASE E.3.3 — LOGGER ESTRUTURADO DO MÓDULO DE ENCOMENDAS.
 *
 * Principios:
 *   - NUNCA logar PIN, QR token, hash, ou dados pessoais completos.
 *   - Todo evento operacional deve incluir condominioId, encomendaId, operation.
 *   - Suporte a correlationId para rastreabilidade ponta a ponta.
 */

export type EncomendaLogEvent =
  | "PACKAGE_CREATE_SUCCESS"
  | "PACKAGE_CREATE_FAILED"
  | "PACKAGE_DUPLICATE_BLOCKED"
  | "PACKAGE_QR_ISSUED"
  | "PACKAGE_PIN_ISSUED"
  | "PACKAGE_WITHDRAW_QR_SUCCESS"
  | "PACKAGE_WITHDRAW_PIN_SUCCESS"
  | "PACKAGE_WITHDRAW_MANUAL_SUCCESS"
  | "PACKAGE_WITHDRAW_REPLAY_BLOCKED"
  | "PACKAGE_PIN_FAILED"
  | "PACKAGE_PIN_LOCKED"
  | "PACKAGE_CROSS_TENANT_BLOCKED"
  | "PACKAGE_OCR_SUCCESS"
  | "PACKAGE_OCR_FAILED"
  | "PACKAGE_CAMERA_ERROR"
  | "PACKAGE_SCANNER_ERROR";

export interface EncomendaLogEntry {
  event: EncomendaLogEvent;
  timestamp: string;
  operation: string;
  result: "success" | "failed" | "blocked" | "error";
  condominioId?: string | null;
  encomendaId?: string | null;
  actorUid?: string | null;
  actorRole?: string | null;
  method?: string | null;
  correlationId?: string | null;
  durationMs?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  /** Número da tentativa (1-based) — ENCOMENDAS.2D, apenas para PIN_FAILED. Nunca o PIN em si. */
  attempt?: number | null;
  /** Timestamp ISO até quando o bloqueio está ativo — ENCOMENDAS.2D, apenas para PIN_LOCKED. */
  lockedUntil?: string | null;
}

function sanitize(entry: EncomendaLogEntry): EncomendaLogEntry {
  const safe = { ...entry };
  delete (safe as any).pin;
  delete (safe as any).pinRaw;
  delete (safe as any).qrToken;
  delete (safe as any).qrTokenRaw;
  delete (safe as any).hash;
  delete (safe as any).pinHash;
  delete (safe as any).qrTokenHash;
  delete (safe as any).token;
  delete (safe as any).codigoRetirada;
  return safe;
}

export function logEncomendaEvent(entry: EncomendaLogEntry): void {
  const safe = sanitize(entry);
  const prefix = `[encomendas]`;
  const extras = [
    safe.correlationId ? `corr=${safe.correlationId}` : "",
    safe.condominioId ? `cond=${safe.condominioId}` : "",
    safe.encomendaId ? `enc=${safe.encomendaId}` : "",
    safe.actorRole ? `role=${safe.actorRole}` : "",
    safe.method ? `method=${safe.method}` : "",
    safe.errorCode ? `code=${safe.errorCode}` : "",
    safe.durationMs ? `dur=${safe.durationMs}ms` : "",
  ].filter(Boolean).join(" ");

  const msg = `${prefix} ${safe.event} ${safe.result} ${extras}`.trim();

  if (safe.result === "error" || safe.result === "failed") {
    console.error(msg, safe.errorMessage || "");
  } else {
    console.log(msg);
  }
}

/** Gera um correlation ID simples (timestamp + random). */
export function generateCorrelationId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

/** Extrai correlationId do header X-Correlation-ID ou gera novo. */
export function extractCorrelationId(req: Request): string {
  try {
    const existing = req.headers.get("x-correlation-id");
    if (existing) return existing;
  } catch { /* headers podem não estar disponíveis */ }
  return generateCorrelationId();
}
