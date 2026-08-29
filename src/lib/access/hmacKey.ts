/**
 * ACCESS.4 — CARREGAMENTO SEGURO DA CHAVE HMAC DO PIN.
 *
 * Fail-closed por design (ACCESS.4 §18): se `pinEnabled` for true e a
 * chave não existir, a operação deve falhar com um erro operacional
 * claro — nunca cair silenciosamente para uma chave hardcoded, vazia,
 * ou para `sha256(pin)` sem chave (o padrão inseguro que ACCESS.3
 * rejeitou explicitamente). Nunca imprime/loga o valor da chave.
 */

const ACCESS_PIN_HMAC_KEY_ENV = "ACCESS_PIN_HMAC_KEY";

export class PinHmacKeyMissingError extends Error {
  constructor() {
    super("ACCESS_PIN_HMAC_KEY não configurada neste ambiente.");
    this.name = "PinHmacKeyMissingError";
  }
}

/**
 * Retorna a chave HMAC configurada para este ambiente, ou lança
 * `PinHmacKeyMissingError` se ausente/vazia. Nunca retorna um valor
 * default/hardcoded.
 */
export function loadPinHmacKey(): string {
  const key = process.env[ACCESS_PIN_HMAC_KEY_ENV];
  if (!key || !key.trim()) {
    throw new PinHmacKeyMissingError();
  }
  return key;
}
