/**
 * ACCESS.3 — PRIMITIVAS DE SEGURANÇA DE CREDENCIAL (QR + PIN).
 *
 * Lógica pura — zero dependência de Next.js/Firestore. Nenhuma função
 * aqui lê/escreve banco; ACCESS.4+ orquestra estas primitivas dentro
 * de transações.
 *
 * ── QR ──
 * Token aleatório de alta entropia (256 bits), nunca persistido em
 * texto claro — apenas seu SHA-256. SHA-256 simples é seguro aqui
 * porque o espaço de busca é astronômico (2^256): um vazamento do
 * banco não torna o token computável por força bruta, ao contrário do
 * PIN abaixo. Mesmo padrão de `src/lib/encomendas/withdrawal.ts`
 * (`generateQRToken`/`hashQRToken`), reimplementado aqui para manter o
 * domínio de Acesso sem dependência cruzada de Encomendas — os dois
 * módulos evoluem por razões de negócio independentes.
 *
 * ── PIN ──
 * Um PIN de 6 dígitos tem apenas 1.000.000 de combinações. SHA-256
 * simples de um PIN (o padrão hoje usado em Encomendas,
 * `hashPin` = `sha256(pin)`) NÃO é proteção adequada contra um vazamento
 * offline do Firestore: um atacante com o hash reconstrói uma tabela
 * de 1M de entradas em milissegundos e recupera o PIN em texto claro
 * — SHA-256 é rápido por design, exatamente a propriedade errada para
 * proteger um segredo de baixa entropia.
 *
 * Este módulo implementa em vez disso um **blind index HMAC-SHA256**
 * (`computePinLookupHash`): `HMAC-SHA256(serverKey, condominioId + ":" + pin)`.
 * Sem a chave do servidor, um vazamento do Firestore sozinho NÃO permite
 * reconstruir a tabela de força bruta — o atacante precisaria também da
 * chave (mantida fora do Firestore, ver nota de provisionamento no
 * relatório ACCESS.3). A vinculação ao `condominioId` no input do HMAC
 * também torna o índice naturalmente tenant-scoped (ACCESS.2 §15): o
 * mesmo PIN em dois condomínios diferentes produz hashes diferentes,
 * então uma consulta de lookup nunca precisa (nem pode) vazar para fora
 * do tenant do operador.
 *
 * IMPORTANTE — decisão explícita registrada no relatório ACCESS.3: a
 * chave do servidor (`ACCESS_PIN_HMAC_KEY` ou nome equivalente) AINDA
 * NÃO existe como segredo provisionado em nenhum ambiente. Este módulo
 * recebe a chave como parâmetro (injeção de dependência) deliberadamente
 * — nenhuma função aqui lê `process.env` diretamente. O provisionamento
 * real do segredo (openssl rand, arquivo root-only 600, ver Rule 6 de
 * AGENTS.md) é uma decisão que precisa de aprovação explícita do
 * arquiteto antes do ACCESS.4 poder de fato chamar estas funções em
 * produção — ver "STOP" no relatório ACCESS.3.
 *
 * A proteção de força bruta ONLINE (tentativas + lockout) é uma camada
 * separada e ortogonal — não depende da chave HMAC, apenas de política
 * (ver `PinAttemptState`/`recordFailedPinAttempt` abaixo).
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// ═══════════════════════════ QR TOKEN ═══════════════════════════

export interface QrTokenResult {
  /** Token bruto de alta entropia — retornar ao chamador SOMENTE no momento da criação; nunca persistir. */
  token: string;
  /** SHA-256 do token — isto (e somente isto) é persistido em `AccessCredential.qrTokenHash`. */
  hash: string;
}

/**
 * Gera um token QR de 256 bits de entropia usando CSPRNG
 * (`crypto.randomBytes`, nunca `Math.random`). O payload do QR (a ser
 * gerado pela UI em fase futura) deve conter SOMENTE este token — nunca
 * o authorizationId, credentialId, condominioId, unitId, ou qualquer
 * campo de `VisitorSnapshot` (ACCESS.2 invariante #9, ACCESS.3 §12).
 */
export function generateQrCredential(): QrTokenResult {
  const token = randomBytes(32).toString("hex"); // 256 bits, 64 chars hex
  return { token, hash: hashQrToken(token) };
}

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Comparação de tempo constante para evitar timing side-channel na
 * validação do QR (o hash já é público-equivalente por ser derivado de
 * SHA-256, mas comparar hash-a-hash com `===` ainda vaza timing
 * proporcional ao prefixo comum; documentando o limite: isto protege a
 * COMPARAÇÃO, não substitui a necessidade de hash-then-lookup — ver
 * `resolveByQrHash` em ACCESS.4).
 */
export function safeCompareHash(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ═══════════════════════════ PIN ═══════════════════════════

const PIN_DIGITS = 6;

/**
 * Gera um PIN de 6 dígitos usando CSPRNG. Permite zero à esquerda
 * (ex. "004821") — o PIN é sempre tratado como string, nunca como
 * número, em toda a stack.
 */
export function generatePin(): string {
  const buf = randomBytes(PIN_DIGITS);
  let out = "";
  for (let i = 0; i < PIN_DIGITS; i++) out += String(buf[i] % 10);
  return out;
}

/**
 * Blind index HMAC-SHA256 para lookup de PIN. `serverKey` é injetada
 * pelo chamador (nunca lida de env aqui) — ver nota de threat model no
 * topo do arquivo. O `condominioId` entra no input do HMAC para que o
 * índice seja intrinsecamente tenant-scoped: mesmo PIN em condomínios
 * diferentes nunca colide no índice.
 */
export function computePinLookupHash(pin: string, condominioId: string, serverKey: string): string {
  return createHmac("sha256", serverKey).update(`${condominioId}:${pin}`, "utf8").digest("hex");
}

// ═══════════════════════════ PIN — FORÇA BRUTA ONLINE ═══════════════════════════

export interface PinAttemptState {
  attempts: number;
  lockedUntil: Date | null;
}

/**
 * Defaults idênticos ao padrão já em produção em Encomendas
 * (`src/lib/encomendas/withdrawal.ts`), reaproveitados aqui como ponto
 * de partida — `AccessPolicy` pode sobrescrever por condomínio no
 * futuro (ACCESS.2 §29), mas o comportamento sem override deve ser
 * consistente com o resto do produto.
 */
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_DURATION_MS = 15 * 60 * 1000;

export function isPinLocked(state: Pick<PinAttemptState, "lockedUntil">, now: Date = new Date()): boolean {
  if (!state.lockedUntil) return false;
  return state.lockedUntil.getTime() > now.getTime();
}

/**
 * Transição pura de estado — NÃO toca Firestore. O chamador (ACCESS.4+)
 * é responsável por persistir o resultado dentro de uma transação.
 */
export function recordFailedPinAttempt(
  state: PinAttemptState,
  now: Date = new Date(),
  maxAttempts: number = PIN_MAX_ATTEMPTS,
  lockDurationMs: number = PIN_LOCK_DURATION_MS,
): PinAttemptState {
  const attempts = state.attempts + 1;
  if (attempts >= maxAttempts) {
    return { attempts, lockedUntil: new Date(now.getTime() + lockDurationMs) };
  }
  return { attempts, lockedUntil: state.lockedUntil };
}

/** Reset após uma resolução bem-sucedida (não após simples leitura/oferta). */
export function resetPinAttempts(): PinAttemptState {
  return { attempts: 0, lockedUntil: null };
}
