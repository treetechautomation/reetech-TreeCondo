/**
 * FASE D.9 — REGULAMENTO ADMIN SERVICE (CICLO DE VIDA COMPLETO).
 *
 * LÓGICA PURA — zero I/O direto com Firestore. Todas as operações delegam
 * leitura/escrita ao RegulamentoRepository (injetado). Testável sem infra.
 *
 * Ciclo de vida:
 *
 *   Rascunho → Validação → Publicação → Histórico → Snapshot → Reservas futuras
 *                ↑                         ↓
 *              Editar                   Revogar
 *
 *   Export → JSON → Import → Rascunho (nunca publica automaticamente)
 *   Clone(A) → Rascunho(B) (nunca publica automaticamente)
 *
 * Garantias:
 *   - publicação nunca sobrescreve histórico;
 *   - importação nunca publica automaticamente;
 *   - clonagem nunca publica automaticamente;
 *   - snapshots de reservas existentes são imutáveis;
 *   - todas as operações são isoladas por condominioId.
 */

import { DEFAULT_POLICY } from "./defaults";
import { mergePolicyLayers } from "./resolver";
import { RULE_CATALOG } from "./catalog";
import { policyHash } from "./versioning";
import { buildSnapshot } from "./snapshots";
import type { RegulamentoRepository } from "./regulamento-repository";
import type {
  ClonePolicyParams,
  ClonePolicyResult,
  ExportPolicyResult,
  ImportPolicyResult,
  OperacaoStatus,
  PolicyDocument,
  PartialPolicy,
  PublishPolicyParams,
  PublishPolicyResult,
  RegulamentoAuthContext,
  RegulamentoDraftInput,
  RegulamentoDraftValidation,
  RegulamentoExport,
  RegulamentoImportValidation,
  RegulamentoVersionInfo,
  RevokePolicyParams,
} from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const KNOWN_RULE_CODES = new Set<string>(RULE_CATALOG.map((r) => r.code));

function validatePolicyDoc(policy: PartialPolicy): string[] {
  const errors: string[] = [];
  if (!policy || typeof policy !== "object") {
    errors.push("Política inválida: deve ser um objeto.");
    return errors;
  }
  return errors;
}

function validateRegras(
  regras: Array<{ code: string; artigo: string }> | undefined,
  artigos: Array<{ artigo: string }> | undefined,
): string[] {
  const errors: string[] = [];
  if (!regras || regras.length === 0) return errors;
  const artigoIds = new Set((artigos ?? []).map((a) => a.artigo));
  for (const regra of regras) {
    if (!KNOWN_RULE_CODES.has(regra.code)) {
      errors.push(`RuleCode desconhecido: "${regra.code}".`);
    }
    if (regra.artigo && !artigoIds.has(regra.artigo)) {
      errors.push(`Regra "${regra.code}" referencia artigo "${regra.artigo}" que não existe.`);
    }
  }
  return errors;
}

function validateExportSchema(data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    errors.push("Payload de importação inválido.");
    return errors;
  }
  const d = data as Record<string, unknown>;
  if (!d.schemaVersion || d.schemaVersion !== 1) {
    errors.push(`Schema version inválido: esperado 1, recebido ${String(d.schemaVersion)}.`);
  }
  if (!d.regulamento || typeof d.regulamento !== "object") {
    errors.push("Campo 'regulamento' ausente ou inválido.");
  }
  return errors;
}

function checkContentHash(data: RegulamentoExport): string | null {
  const { contentHash, regulamento } = data;
  const computed = policyHash(regulamento.policy as unknown as PolicyDocument);
  if (computed !== contentHash) {
    return `Hash de integridade inválido: esperado ${contentHash}, calculado ${computed}.`;
  }
  return null;
}

function buildVersionInfo(
  condominioId: string,
  version: number,
  policy: PolicyDocument,
  author: RegulamentoAuthContext,
  observacao: string,
  status: "PUBLICADA" | "REVOGADA",
): RegulamentoVersionInfo {
  return {
    version,
    publishedAt: new Date().toISOString(),
    authorUid: author.uid,
    authorNome: author.nome,
    contentHash: policyHash(policy),
    observacao,
    status,
  };
}

function diffPolicies(a: PolicyDocument, b: PolicyDocument): string[] {
  const diffs: string[] = [];
  const jsonA = JSON.stringify(a, Object.keys(a).sort());
  const jsonB = JSON.stringify(b, Object.keys(b).sort());
  if (jsonA === jsonB) return diffs;
  diffs.push("Políticas diferem (hash mismatch).");
  // Diff campo a campo no nível raiz
  for (const key of Object.keys(a) as Array<keyof PolicyDocument>) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      diffs.push(`Campo "${key}": divergente.`);
    }
  }
  return diffs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGULAMENTO ADMIN SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export function createRegulamentoAdminService(repo: RegulamentoRepository) {
  // ── Rascunho ─────────────────────────────────────────────────────────────

  async function createDraft(
    condominioId: string,
    input: RegulamentoDraftInput,
  ): Promise<OperacaoStatus> {
    return repo.saveDraft(condominioId, input);
  }

  async function getDraft(condominioId: string) {
    return repo.getDraft(condominioId);
  }

  async function updateDraft(
    condominioId: string,
    input: RegulamentoDraftInput,
  ): Promise<OperacaoStatus> {
    const existing = await repo.getDraft(condominioId);
    if (!existing) {
      return { success: false, message: "Nenhum rascunho existente para editar." };
    }
    return repo.saveDraft(condominioId, input);
  }

  async function discardDraft(condominioId: string): Promise<OperacaoStatus> {
    return repo.deleteDraft(condominioId);
  }

  // ── Validação ────────────────────────────────────────────────────────────

  async function validateDraft(
    condominioId: string,
  ): Promise<RegulamentoDraftValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const draft = await repo.getDraft(condominioId);
    if (!draft) {
      return { valid: false, errors: ["Nenhum rascunho encontrado."], warnings: [] };
    }

    errors.push(...validatePolicyDoc(draft.policy));
    errors.push(...validateRegras(
      draft.regras as Array<{ code: string; artigo: string }> | undefined,
      draft.artigos as Array<{ artigo: string }> | undefined,
    ));

    // Validar artigos: pelo menos um artigo ativo
    const activeArts = (draft.artigos ?? []).filter((a) => a.ativo);
    if ((draft.artigos ?? []).length > 0 && activeArts.length === 0) {
      warnings.push("Nenhum artigo ativo no regulamento.");
    }

    // Resolver política
    const resolved = mergePolicyLayers([
      { level: "CONDOMINIO", data: draft.policy },
    ]);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      resolvedPolicy: resolved.policy,
    };
  }

  // ── Publicação ───────────────────────────────────────────────────────────

  async function publishPolicy(
    params: PublishPolicyParams,
  ): Promise<PublishPolicyResult> {
    const { condominioId, author, observacao } = params;

    if (author.condominioId !== condominioId) {
      return {
        success: false, version: 0,
        message: `Autor "${author.uid}" não pertence ao condomínio "${condominioId}".`,
        policy: DEFAULT_POLICY,
        snapshot: buildSnapshot({ policy: DEFAULT_POLICY, version: 0, target: { condominioId, areaId: "" }, provenance: {}, resolvedAt: new Date().toISOString() }),
      };
    }

    // Validar rascunho antes de publicar
    const validation = await validateDraft(condominioId);
    if (!validation.valid) {
      return {
        success: false, version: 0,
        message: `Rascunho inválido: ${validation.errors.join("; ")}.`,
        policy: DEFAULT_POLICY,
        snapshot: buildSnapshot({ policy: DEFAULT_POLICY, version: 0, target: { condominioId, areaId: "" }, provenance: {}, resolvedAt: new Date().toISOString() }),
      };
    }

    const policy = validation.resolvedPolicy ?? DEFAULT_POLICY;
    const nextVersion = (await repo.getLatestVersion(condominioId)) + 1;

    const versionInfo = buildVersionInfo(
      condominioId, nextVersion, policy, author, observacao, "PUBLICADA",
    );

    const result = await repo.publish(condominioId, versionInfo);
    if (!result.success) {
      return {
        success: false, version: 0,
        message: result.message,
        policy: DEFAULT_POLICY,
        snapshot: buildSnapshot({ policy: DEFAULT_POLICY, version: 0, target: { condominioId, areaId: "" }, provenance: {}, resolvedAt: new Date().toISOString() }),
      };
    }

    const snapshot = buildSnapshot(
      { policy, version: nextVersion, target: { condominioId, areaId: "" }, provenance: {}, resolvedAt: new Date().toISOString() },
    );

    return {
      success: true,
      version: nextVersion,
      message: `Regulamento v${nextVersion} publicado com sucesso.`,
      contentHash: versionInfo.contentHash,
      policy,
      snapshot,
    };
  }

  // ── Revogação ────────────────────────────────────────────────────────────

  async function revokePolicy(
    params: RevokePolicyParams,
  ): Promise<OperacaoStatus> {
    const { condominioId, author, observacao } = params;

    const published = await repo.getPublished(condominioId);
    if (!published) {
      return { success: false, message: "Nenhum regulamento publicado para revogar." };
    }

    const nextVersion = published.currentVersion + 1;
    const versionInfo = buildVersionInfo(
      condominioId, nextVersion, published.policy, author, observacao, "REVOGADA",
    );

    return repo.revoke(condominioId, versionInfo);
  }

  // ── Histórico ────────────────────────────────────────────────────────────

  async function getHistory(condominioId: string) {
    return repo.getHistory(condominioId);
  }

  async function getVersion(condominioId: string, version: number) {
    return repo.getVersion(condominioId, version);
  }

  // ── Exportação ───────────────────────────────────────────────────────────

  async function exportPolicy(
    condominioId: string,
  ): Promise<ExportPolicyResult> {
    const data = await repo.buildExport(condominioId);
    if (!data) {
      return { success: false, data: null, error: "Nenhum regulamento para exportar." };
    }
    return { success: true, data };
  }

  // ── Importação ───────────────────────────────────────────────────────────

  async function importPolicy(
    condominioId: string,
    data: RegulamentoExport,
  ): Promise<ImportPolicyResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar schema
    errors.push(...validateExportSchema(data));
    if (errors.length > 0) {
      return {
        success: false,
        validation: { valid: false, importedVersion: 0, warnings, errors },
      };
    }

    // Validar hash
    const hashError = checkContentHash(data);
    if (hashError) errors.push(hashError);

    // Validar regras
    const { regras, artigos } = data.regulamento;
    errors.push(...validateRegras(
      regras as Array<{ code: string; artigo: string }> | undefined,
      artigos as Array<{ artigo: string }> | undefined,
    ));

    if (errors.length > 0) {
      return {
        success: false,
        validation: {
          valid: false,
          importedVersion: data.regulamento.currentVersion,
          warnings, errors,
        },
      };
    }

    // Importar como rascunho — NUNCA publica automaticamente
    const result = await repo.importDraft(condominioId, data);
    return {
      success: result.success,
      validation: {
        valid: true,
        importedVersion: data.regulamento.currentVersion,
        warnings, errors: [],
      },
      draftVersion: result.version,
    };
  }

  // ── Clonagem ─────────────────────────────────────────────────────────────

  async function clonePolicy(
    params: ClonePolicyParams,
  ): Promise<ClonePolicyResult> {
    const { sourceCondominioId, targetCondominioId, author, observacao, overwrite } = params;

    if (sourceCondominioId === targetCondominioId) {
      return { success: false, contentHash: "", differences: [], error: "Origem e destino são o mesmo condomínio." };
    }

    if (author.condominioId !== targetCondominioId) {
      return { success: false, contentHash: "", differences: [], error: "Autor não pertence ao condomínio de destino." };
    }

    // Se não sobrescrever, verificar se já existe rascunho
    if (!overwrite) {
      const existing = await repo.getDraft(targetCondominioId);
      if (existing) {
        return {
          success: false, contentHash: "",
          differences: [], error: "Condomínio de destino já possui rascunho. Use overwrite=true.",
        };
      }
    }

    // Obter regulamento da origem para clonar
    const sourceExport = await repo.buildExport(sourceCondominioId);
    if (!sourceExport) {
      return { success: false, contentHash: "", differences: [], error: "Condomínio de origem não possui regulamento." };
    }

    // Clonar como rascunho no destino — NUNCA publica automaticamente
    const result = await repo.importDraft(targetCondominioId, sourceExport);
    if (!result.success) {
      return { success: false, contentHash: "", differences: [], error: result.message };
    }

    // Comparar diferenças
    const sourcePolicy = sourceExport.regulamento.policy;
    const targetDraft = await repo.getDraft(targetCondominioId);
    const differences = diffPolicies(
      sourcePolicy as unknown as PolicyDocument,
      (targetDraft?.policy ?? DEFAULT_POLICY) as unknown as PolicyDocument,
    );

    return {
      success: true,
      draftVersion: result.version,
      contentHash: policyHash(targetDraft?.policy ?? DEFAULT_POLICY),
      differences,
    };
  }

  return {
    // Rascunho
    createDraft,
    getDraft,
    updateDraft,
    discardDraft,
    // Validação
    validateDraft,
    // Publicação / Revogação
    publishPolicy,
    revokePolicy,
    // Histórico
    getHistory,
    getVersion,
    // Export / Import
    exportPolicy,
    importPolicy,
    // Clone
    clonePolicy,
  };
}

export type RegulamentoAdminService = ReturnType<typeof createRegulamentoAdminService>;
