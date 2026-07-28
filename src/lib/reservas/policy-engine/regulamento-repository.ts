/**
 * FASE D.9 — REGULAMENTO REPOSITORY (CONTRATO CRUD).
 *
 * Define a interface de I/O para operações de administração de regulamentos.
 *
 * Implementação concreta (Firestore) virá em fase posterior.
 * Todos os métodos recebem condominioId explicitamente — NUNCA operam
 * em escopo global.
 */

import type {
  OperacaoStatus,
  PolicyDocument,
  PolicySnapshot,
  RegulamentoArtigo,
  RegulamentoDraftInput,
  RegulamentoDocument,
  RegulamentoExport,
  RegulamentoRegra,
  RegulamentoVersionInfo,
} from "./types";

/** Contrato do repositório de regulamentos (futura implementação Firestore). */
export interface RegulamentoRepository {
  // ── Rascunho ───────────────────────────────────────────────────────────────

  /** Obtém o rascunho atual do condomínio (null se não existir). */
  getDraft(condominioId: string): Promise<RegulamentoDocument | null>;

  /** Cria ou sobrescreve o rascunho. */
  saveDraft(condominioId: string, input: RegulamentoDraftInput): Promise<OperacaoStatus>;

  /** Remove o rascunho (ex.: descartar alterações). */
  deleteDraft(condominioId: string): Promise<OperacaoStatus>;

  // ── Publicação ─────────────────────────────────────────────────────────────

  /** Obtém a versão publicada atual (null se nunca publicada). */
  getPublished(condominioId: string): Promise<RegulamentoDocument | null>;

  /**
   * Publica o rascunho atual.
   * Internamente: valida → incrementa versão → congela → move para publicada →
   * grava histórico → limpa rascunho.
   */
  publish(condominioId: string, versionInfo: RegulamentoVersionInfo): Promise<OperacaoStatus>;

  // ── Revogação ──────────────────────────────────────────────────────────────

  /** Marca a versão publicada como REVOGADA. Jamais apaga. */
  revoke(condominioId: string, versionInfo: RegulamentoVersionInfo): Promise<OperacaoStatus>;

  // ── Histórico ──────────────────────────────────────────────────────────────

  /** Lista o histórico de versões (da mais recente para a mais antiga). */
  getHistory(condominioId: string): Promise<RegulamentoVersionInfo[]>;

  /** Obtém uma versão específica do histórico pelo número. */
  getVersion(condominioId: string, version: number): Promise<RegulamentoDocument | null>;

  // ── Exportação / Importação ────────────────────────────────────────────────

  /** Monta o payload de exportação a partir dos dados do condomínio. */
  buildExport(condominioId: string): Promise<RegulamentoExport | null>;

  /**
   * Cria um rascunho a partir de dados importados.
   * NUNCA publica automaticamente.
   */
  importDraft(condominioId: string, data: RegulamentoExport): Promise<OperacaoStatus>;

  // ── Metadados ──────────────────────────────────────────────────────────────

  /** Obtém o número da última versão publicada (0 se nunca publicada). */
  getLatestVersion(condominioId: string): Promise<number>;
}
