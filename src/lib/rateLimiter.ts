/**
 * Rate Limiter V2 — Sliding window em memória.
 *
 * V1 (retrocompatível): checkRateLimit, rateLimitKey, rateLimitResponse
 * V2 (novo):          checkRateLimitV2, resolveTierLimit, RateLimitTier
 *
 * Para produção com múltiplos workers, usar Redis.
 */

type RateEntry = { count: number; resetAt: number };

const store = new Map<string, RateEntry>();

if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 60_000);
  // unref(): não impede o processo de encerrar naturalmente quando não há
  // mais trabalho pendente (scripts, test runners). Sem efeito no servidor
  // de longa duração — o timer continua disparando normalmente enquanto o
  // processo está vivo.
  cleanupTimer.unref?.();
}

// ── V1 (retrocompatível) ──────────────────────────────────────────────────────

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
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

export function rateLimitKey(uid: string | null, ip: string | null, endpoint: string): string {
  return `${uid || ip || "anon"}:${endpoint}`;
}

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

// ── V2 (tiers, tenant, role) ──────────────────────────────────────────────────

export type RateLimitTier = "DEFAULT" | "SUPER_ADMIN" | "ADMIN" | "ADMIN_CONDOMINIO" | "SINDICO" | "PORTEIRO" | "ZELADOR" | "SEGURANCA" | "MORADOR";

export interface TierConfig {
  limit: number;
  windowSec: number;
}

export interface EndpointTierConfig {
  [endpoint: string]: {
    [tier in RateLimitTier]?: TierConfig;
  };
}

export const DEFAULT_TIER_LIMITS: Record<RateLimitTier, TierConfig> = {
  SUPER_ADMIN: { limit: 600, windowSec: 60 },
  ADMIN: { limit: 300, windowSec: 60 },
  ADMIN_CONDOMINIO: { limit: 300, windowSec: 60 },
  SINDICO: { limit: 300, windowSec: 60 },
  PORTEIRO: { limit: 200, windowSec: 60 },
  ZELADOR: { limit: 200, windowSec: 60 },
  SEGURANCA: { limit: 100, windowSec: 60 },
  MORADOR: { limit: 60, windowSec: 60 },
  DEFAULT: { limit: 30, windowSec: 60 },
};

const ENDPOINT_OVERRIDES: EndpointTierConfig = {};

export function setTierConfig(endpoint: string, tierConfigs: Partial<Record<RateLimitTier, TierConfig>>) {
  ENDPOINT_OVERRIDES[endpoint] = tierConfigs as Record<RateLimitTier, TierConfig>;
}

export function resolveTierLimit(endpoint: string, tier: RateLimitTier): TierConfig {
  const override = ENDPOINT_OVERRIDES[endpoint]?.[tier];
  if (override) return override;
  return DEFAULT_TIER_LIMITS[tier] || DEFAULT_TIER_LIMITS.DEFAULT;
}

export function resolveTier(role: string | null | undefined): RateLimitTier {
  const r = String(role || "").toUpperCase().trim();
  if (r === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (r === "ADMIN") return "ADMIN";
  if (r === "ADMIN_CONDOMINIO") return "ADMIN_CONDOMINIO";
  if (r === "SINDICO") return "SINDICO";
  if (r === "PORTEIRO") return "PORTEIRO";
  if (r === "ZELADOR") return "ZELADOR";
  if (r === "SEGURANCA") return "SEGURANCA";
  if (r === "MORADOR") return "MORADOR";
  return "DEFAULT";
}

export interface RateLimitV2Config {
  uid: string | null;
  ip: string | null;
  endpoint: string;
  tenantId?: string | null;
  role?: string | null;
}

export function checkRateLimitV2(config: RateLimitV2Config): RateLimitResult {
  const tier = resolveTier(config.role);
  const tierLimit = resolveTierLimit(config.endpoint, tier);

  const keyParts = [config.uid || config.ip || "anon"];
  if (config.tenantId) keyParts.push(config.tenantId);
  keyParts.push(config.endpoint);

  return checkRateLimit({
    key: keyParts.join(":"),
    limit: tierLimit.limit,
    windowSec: tierLimit.windowSec,
  });
}
