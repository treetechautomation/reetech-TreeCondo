/**
 * FASE D.3 — POLICY ENGINE — RESOLVER.
 *
 * Resolução hierárquica determinística (D.2 §1.1, ajustada na homologação):
 *
 *   Opção  →  Área  →  Condomínio  →  Default interno
 *
 * Nunca o contrário. O merge é por CAMPO FOLHA, com proveniência registrada
 * campo a campo para auditoria/explain.
 *
 * Este módulo não conhece Firestore: recebe os parciais via PolicyRepository.
 */

import type {
  PartialPolicy,
  PolicyDocument,
  PolicyLevel,
  PolicyProvenance,
  PolicyRepository,
  PolicyTargetRef,
  ResolvedPolicy,
} from "./types";
import { DEFAULT_POLICY, getLegacyPolicyForCondominio } from "./defaults";

type Layer = { level: PolicyLevel; data: PartialPolicy | null };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Merge por campo folha. Camadas em ordem de precedência DECRESCENTE
 * (a primeira que definir o campo vence). Arrays são valores atômicos.
 * O template DEFAULT_POLICY preenche apenas campos que nenhuma camada definiu —
 * inclusive LEGACY_POLICY (que é o regulamento base de condomínios existentes).
 */
export function mergePolicyLayers(layers: Layer[]): {
  policy: PolicyDocument;
  provenance: PolicyProvenance;
} {
  const provenance: PolicyProvenance = {};

  function build(template: unknown, path: string): unknown {
    if (isPlainObject(template)) {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(template)) {
        out[key] = build(template[key], path ? `${path}.${key}` : key);
      }
      return out;
    }
    // Campo folha (primitivo, null ou array): primeira camada que o define vence.
    for (const layer of layers) {
      const v = leafAt(layer.data, path);
      if (v !== undefined) {
        provenance[path] = layer.level;
        return v;
      }
    }
    provenance[path] = "DEFAULT";
    return template;
  }

  const policy = build(DEFAULT_POLICY, "") as PolicyDocument;
  return { policy, provenance };
}

function leafAt(source: PartialPolicy | null, path: string): unknown {
  if (!source) return undefined;
  let cur: unknown = source;
  for (const seg of path.split(".")) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[seg];
    if (cur === undefined) return undefined;
  }
  // Objetos intermediários não são folhas válidas para este template.
  if (isPlainObject(cur)) return undefined;
  return cur;
}

/**
 * Resolve a política vigente para o alvo (condominio/área/opção).
 * I/O acontece exclusivamente via repository (que pode cachear por versão).
 */
export async function resolvePolicy(
  repo: PolicyRepository,
  target: PolicyTargetRef,
  now: Date = new Date()
): Promise<ResolvedPolicy> {
  const [versionInfo, condominioPolicy, areaPolicy, opcaoPolicy] = await Promise.all([
    repo.getPublishedVersion(target.condominioId),
    repo.getCondominioPolicy(target.condominioId),
    repo.getAreaPolicy(target.condominioId, target.areaId),
    target.opcaoId
      ? repo.getOpcaoPolicy(target.condominioId, target.areaId, target.opcaoId)
      : Promise.resolve(null),
  ]);

  // FASE D.8.1 (P0 ARCH): o fallback legado é EXCLUSIVO do condomínio
  // registrado. Condomínios não listados no LEGACY_POLICY_REGISTRY NUNCA
  // herdam política da Chácara — recebem DEFAULT_POLICY (neutra).
  const legacyFallback = getLegacyPolicyForCondominio(target.condominioId);
  const layers: Layer[] = [
    { level: "OPCAO", data: opcaoPolicy },
    { level: "AREA", data: areaPolicy },
    { level: "CONDOMINIO", data: condominioPolicy },
  ];
  if (legacyFallback) {
    layers.push({ level: "DEFAULT", data: legacyFallback as PartialPolicy });
  }

  const { policy, provenance } = mergePolicyLayers(layers);

  return {
    policy,
    version: versionInfo.version,
    target,
    provenance,
    resolvedAt: now.toISOString(),
  };
}
