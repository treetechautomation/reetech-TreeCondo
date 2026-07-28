/**
 * Rate Limiter em memória para APIs do TreeCondo.
 * Estratégia: sliding window por UID + IP.
 * Para produção com múltiplos workers, usar Redis.
 */

type RateEntry = { count: number; resetAt: number };

const store = new Map<string, RateEntry>();

// Limpeza periódica para evitar vazamento de memória
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 60_000);
}

export interface RateLimitConfig {
  /** Chave única (ex: `${uid}:${endpoint}` ou `${ip}:${endpoint}`) */
  key: string;
  /** Máximo de requests na janela */
  limit: number;
  /** Duração da janela em segundos */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms
}

export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;

  let entry = store.get(config.key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(config.key, entry);
  }

  entry.count++;
  const allowed = entry.count <= config.limit;
  const remaining = Math.max(0, config.limit - entry.count);

  return { allowed, remaining, resetAt: entry.resetAt };
}

/**
 * Extrai o UID do token Firebase decodificado ou usa IP como fallback.
 */
export function rateLimitKey(uid: string | null, ip: string | null, endpoint: string): string {
  return `${uid || ip || "anon"}:${endpoint}`;
}

/**
 * Resposta padronizada quando o rate limit é excedido.
 */
export function rateLimitResponse(result: RateLimitResult) {
  const { NextResponse } = require("next/server");
  return NextResponse.json(
    { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Remaining": String(result.remaining),
        "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
      },
    }
  );
}
