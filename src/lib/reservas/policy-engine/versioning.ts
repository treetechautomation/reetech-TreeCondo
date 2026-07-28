/**
 * FASE D.3 — POLICY ENGINE — VERSIONAMENTO.
 *
 * - Versão 0 = política LEGADA: paridade absoluta com o comportamento
 *   congelado/homologado (nenhum doc de versão publicado no Firestore).
 * - Versões > 0 serão publicadas pela administração na D.6.
 * - Hash de conteúdo (FNV-1a 64 bits sobre JSON canônico) garante integridade
 *   do snapshot e detecção de divergência — puro e isomórfico (server/client).
 */

import type { PolicyDocument, PolicyVersionInfo } from "./types";

export const LEGACY_POLICY_VERSION = 0;
export const ENGINE_SCHEMA_VERSION = 1 as const;

export const LEGACY_VERSION_INFO: PolicyVersionInfo = {
  version: LEGACY_POLICY_VERSION,
  publishedAt: null,
};

/** Serialização canônica (chaves ordenadas) para hashing estável. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Hash de conteúdo de 64 bits (hex) composto por duas passadas FNV-1a de
 * 32 bits com seeds distintos — sem BigInt (target ES2017) e sem crypto,
 * para rodar idêntico no server e no client.
 */
export function contentHash64Hex(input: string): string {
  return fnv1a32Hex(input, 0x811c9dc5) + fnv1a32Hex(input, 0x811c9dc5 ^ 0x5bd1e995);
}

function fnv1a32Hex(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    const high = code >> 8;
    if (high) {
      hash ^= high & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
}

export function policyHash(policy: PolicyDocument): string {
  return contentHash64Hex(canonicalJson(policy));
}

export function isLegacyVersion(version: number | null | undefined): boolean {
  return !Number.isFinite(Number(version)) || Number(version) <= LEGACY_POLICY_VERSION;
}
