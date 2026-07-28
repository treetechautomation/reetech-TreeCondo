/**
 * FASE D.8 — POLICY ENGINE — REGULAMENTO SERVICE (CONTRATOS).
 *
 * Define as interfaces para administração de regulamentos multi-condomínio.
 *
 * NESTA FASE: SOMENTE CONTRATOS. ZERO implementação. ZERO Firestore writes.
 * ZERO CRUD. ZERO editor. ZERO frontend.
 *
 * As implementações concretas (FirestoreRegulamentoService) virão na D.9.
 *
 * Operações contratadas:
 *   - exportRegulamento     → JSON portável;
 *   - importRegulamento     → validação + merge;
 *   - cloneRegulamento      → duplicar entre condomínios;
 *   - validateRegulamento   → validar estrutura e compatibilidade;
 *   - diffRegulamentos      → comparar dois regulamentos (auditoria);
 *   - resolveHeranca        → resolver política com herança entre níveis.
 */

import type {
  PartialPolicy,
  PolicyDocument,
  PolicyLevel,
  RegulamentoCloneParams,
  RegulamentoCloneResult,
  RegulamentoExport,
  RegulamentoImportValidation,
  HerancaConfig,
  ResolvedPolicy,
  PolicyTargetRef,
} from "./types";

/** Contrato do serviço de regulamentos (futura implementação no Firestore). */
export interface RegulamentoService {
  /**
   * Exporta o regulamento de um condomínio para formato JSON portável.
   * Inclui metadados, artigos, regras, política compilada e hash de integridade.
   */
  exportRegulamento(condominioId: string): Promise<RegulamentoExport>;

  /**
   * Valida e importa um regulamento a partir de JSON exportado.
   * Verifica schema, hash de integridade, compatibilidade de regras.
   * NÃO publica — apenas valida e retorna a política resolvida.
   */
  importRegulamento(data: RegulamentoExport): Promise<RegulamentoImportValidation>;

  /**
   * Clona o regulamento de um condomínio para outro.
   * Preserva versão, artigos, regras e política.
   * Permite sobrescrever ou criar novo.
   */
  cloneRegulamento(params: RegulamentoCloneParams): Promise<RegulamentoCloneResult>;

  /**
   * Valida a estrutura interna de um regulamento:
   * artigos referenciados por regras existem, RuleCodes são do catálogo,
   * política é válida.
   */
  validateRegulamento(condominioId: string, version?: number): Promise<RegulamentoImportValidation>;

  /**
   * Compara duas versões de regulamento (ou dois condomínios) e retorna
   * as diferenças campo a campo. Útil para auditoria e preview de merge.
   */
  diffRegulamentos(
    sourceCondominioId: string,
    targetCondominioId: string,
    sourceVersion?: number,
    targetVersion?: number,
  ): Promise<RegulamentoCloneResult>;
}

/** Utilitários puros para herança de políticas (sem I/O). */
export const HerancaUtils = {
  /**
   * Resolve a política para um nível hierárquico, aplicando herança.
   *
   *   BASE (regulamento) → Condomínio → Área → Opção
   *
   * Cada nível pode INHERIT, OVERRIDE, EXTEND ou REPLACE campos do nível pai.
   * O resultado é um ResolvedPolicy com proveniência campo a campo.
   */
  resolveHeranca(
    base: PolicyDocument,
    layers: Array<{
      target: PolicyTargetRef;
      partial: PartialPolicy | null;
      config: HerancaConfig;
    }>,
  ): ResolvedPolicy {
    let policy = { ...base };
    const provenance: Record<string, PolicyLevel> = {};

    for (const layer of layers) {
      if (!layer.partial) continue;
      const level: PolicyLevel =
        layer.target.opcaoId ? "OPCAO" :
        layer.target.areaId ? "AREA" : "CONDOMINIO";

      policy = mergeWithHeranca(policy, layer.partial, layer.config, level, provenance);
    }

    return {
      policy,
      version: 0, // versão será definida pelo repositório
      target: layers[layers.length - 1]?.target ?? { condominioId: "", areaId: "" },
      provenance,
      resolvedAt: new Date().toISOString(),
    };
  },
};

function mergeWithHeranca(
  base: PolicyDocument,
  partial: PartialPolicy,
  config: HerancaConfig,
  level: PolicyLevel,
  provenance: Record<string, PolicyLevel>,
): PolicyDocument {
  const result = structuredClone(base) as Record<string, unknown>;

  function walk(baseObj: unknown, partialObj: unknown, path: string): void {
    if (partialObj === undefined || partialObj === null) return;

    if (Array.isArray(partialObj)) {
      const mode = config.fieldOverrides?.[path] ?? config.defaultMode;
      if (mode === "REPLACE") {
        setAt(result, path, [...partialObj]);
        provenance[path] = level;
      } else if (mode === "EXTEND") {
        const existing = getAt(result, path);
        const merged = [...(Array.isArray(existing) ? existing : []), ...partialObj];
        setAt(result, path, merged);
        provenance[path] = level;
      }
      // INHERIT/OVERRIDE não se aplicam a arrays (mantém o existente)
      return;
    }

    if (typeof partialObj === "object") {
      const baseVal = getAt(base as unknown as Record<string, unknown>, path);
      for (const key of Object.keys(partialObj as Record<string, unknown>)) {
        const subPath = path ? `${path}.${key}` : key;
        walk(
          (baseVal as Record<string, unknown>)?.[key],
          (partialObj as Record<string, unknown>)[key],
          subPath,
        );
      }
      return;
    }

    // Campo folha (primitivo)
    const mode = config.fieldOverrides?.[path] ?? config.defaultMode;
    if (mode === "INHERIT") return; // mantém o valor base
    setAt(result, path, partialObj);
    provenance[path] = level;
  }

  walk(base, partial, "");
  return result as unknown as PolicyDocument;
}

function getAt(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function setAt(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segs = path.split(".");
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (!cur[segs[i]] || typeof cur[segs[i]] !== "object") {
      cur[segs[i]] = {};
    }
    cur = cur[segs[i]] as Record<string, unknown>;
  }
  cur[segs[segs.length - 1]] = value;
}
