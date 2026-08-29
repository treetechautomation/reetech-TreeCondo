/**
 * ACCESS.3 — DEFAULTS DE AccessPolicy.
 *
 * `/condominios/{condominioId}/config/accessPolicy` — mesmo padrão de
 * `config/reservasPolicy` e `config/menuPermissions` já em uso no
 * projeto. Este módulo NÃO cria nem lê o documento — apenas define os
 * defaults seguros a aplicar quando o condomínio ainda não publicou uma
 * policy própria (ACCESS.4+ decide onde/como mesclar).
 *
 * `requireEntryConfirmation`/`requireExitConfirmation` NÃO existem como
 * campos aqui — confirmação explícita é uma invariante do domínio
 * (ACCESS.2 invariante #2), não uma opção de tenant. Nenhum campo deste
 * schema pode permitir violar essa invariante (ACCESS.3 §20).
 */

import type { AccessPolicy } from "./types";
import { DEFAULT_ACCESS_TIMEZONE } from "./timezone";
import { PIN_MAX_ATTEMPTS, PIN_LOCK_DURATION_MS } from "./credential";

export const DEFAULT_ACCESS_POLICY: AccessPolicy = {
  qrEnabled: true,
  pinEnabled: true,
  pendingExitAfterMinutes: 60,
  autoCloseAfterMinutes: 240,
  timezone: DEFAULT_ACCESS_TIMEZONE,
};

/** Reexportados aqui para consumidores de policy que precisem dos mesmos defaults de tentativa/bloqueio de PIN sem importar de `credential.ts` diretamente. */
export const DEFAULT_PIN_MAX_ATTEMPTS = PIN_MAX_ATTEMPTS;
export const DEFAULT_PIN_LOCK_DURATION_MS = PIN_LOCK_DURATION_MS;

/** Mescla uma policy parcial (documento real, possivelmente incompleto) com os defaults — nunca lança, nunca deixa campo obrigatório ausente. */
export function resolveAccessPolicy(stored: Partial<AccessPolicy> | null | undefined): AccessPolicy {
  return { ...DEFAULT_ACCESS_POLICY, ...(stored ?? {}) };
}
