/**
 * ACCESS.4 — CONTRATO DE ERRO DAS ROTAS DE ACESSO.
 *
 * Categorias fixas (ACCESS.4 §31). Nunca vazar existência de
 * credencial, hash, comportamento de HMAC, ou detalhes internos de
 * tenant na mensagem.
 */

export const ACCESS_API_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "NO_ACTIVE_UNIT",
  "INVALID_UNIT",
  "POLICY_DISABLED",
  "CONFIGURATION_ERROR",
  "NOT_FOUND",
  "ALREADY_REVOKED",
  "PIN_GENERATION_FAILED",
] as const;
export type AccessApiErrorCode = (typeof ACCESS_API_ERROR_CODES)[number];

const HTTP_STATUS_BY_CODE: Record<AccessApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  NO_ACTIVE_UNIT: 403,
  INVALID_UNIT: 400,
  POLICY_DISABLED: 409,
  CONFIGURATION_ERROR: 500,
  NOT_FOUND: 404,
  ALREADY_REVOKED: 200, // idempotent success, not an error (§27)
  PIN_GENERATION_FAILED: 503,
};

export class AccessApiError extends Error {
  code: AccessApiErrorCode;
  constructor(code: AccessApiErrorCode, message: string) {
    super(message);
    this.name = "AccessApiError";
    this.code = code;
  }
  get httpStatus(): number {
    return HTTP_STATUS_BY_CODE[this.code];
  }
}
