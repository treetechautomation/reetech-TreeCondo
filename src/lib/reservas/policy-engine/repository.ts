/**
 * FASE D.3 — POLICY ENGINE — REPOSITORY (porta de I/O) + CACHE.
 *
 * A interface PolicyRepository (types.ts) é a ÚNICA porta de I/O do engine.
 * Este módulo fornece o decorator de cache (ajuste obrigatório D.3 §5):
 *
 *   Fluxo:  cache → Firestore
 *   Invalidação: EXCLUSIVAMENTE por policyVersion. Jamais por tempo.
 *
 * Semântica:
 *  - getPublishedVersion sempre atravessa para o adapter (1 leitura barata);
 *  - os corpos de política (condomínio/área/opção) são cacheados com chave
 *    composta pela versão publicada — mudou a versão, o cache antigo torna-se
 *    inalcançável e é descartado;
 *  - FATOS (membro, quota) NUNCA são cacheados: são dados vivos do motor.
 */

import type { PartialPolicy, PolicyRepository } from "./types";

type CacheEntry = { value: PartialPolicy | null };

export function createCachedPolicyRepository(inner: PolicyRepository): PolicyRepository {
  const cache = new Map<string, CacheEntry>();
  const cachedCondoVersion = new Map<string, number>();

  function invalidateIfVersionChanged(condominioId: string, version: number): void {
    const prev = cachedCondoVersion.get(condominioId);
    if (prev !== undefined && prev !== version) {
      const prefix = `${condominioId}::`;
      for (const key of Array.from(cache.keys())) {
        if (key.startsWith(prefix)) cache.delete(key);
      }
    }
    cachedCondoVersion.set(condominioId, version);
  }

  async function readThrough(
    condominioId: string,
    key: string,
    load: () => Promise<PartialPolicy | null>
  ): Promise<PartialPolicy | null> {
    const versionInfo = await inner.getPublishedVersion(condominioId);
    invalidateIfVersionChanged(condominioId, versionInfo.version);
    const fullKey = `${condominioId}::v${versionInfo.version}::${key}`;
    const hit = cache.get(fullKey);
    if (hit) return hit.value;
    const value = await load();
    cache.set(fullKey, { value });
    return value;
  }

  return {
    getPublishedVersion: (condominioId) => inner.getPublishedVersion(condominioId),

    getCondominioPolicy: (condominioId) =>
      readThrough(condominioId, "condominio", () => inner.getCondominioPolicy(condominioId)),

    getAreaPolicy: (condominioId, areaId) =>
      readThrough(condominioId, `area:${areaId}`, () => inner.getAreaPolicy(condominioId, areaId)),

    getOpcaoPolicy: (condominioId, areaId, opcaoId) =>
      readThrough(condominioId, `opcao:${areaId}:${opcaoId}`, () =>
        inner.getOpcaoPolicy(condominioId, areaId, opcaoId)
      ),

    // Fatos vivos — nunca cacheados.
    getMemberFacts: (condominioId, uid) => inner.getMemberFacts(condominioId, uid),
    getQuotaFacts: (condominioId, query) => inner.getQuotaFacts(condominioId, query),
  };
}
