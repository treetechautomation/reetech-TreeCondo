/**
 * G1.7.1 — Tipos da entidade global Licenciamento (Painel Global Treetech).
 *
 * Licenciamento é a fundação do relacionamento Empresa ↔ Produto:
 *
 *   Empresa
 *     ↓
 *   Licenciamento
 *     ↓
 *   Produto
 *
 * Representa exclusivamente "esta empresa possui autorização para utilizar
 * este produto" — não pertence ao Produto nem ao Cliente. Nesta fase: sem
 * planos, assinaturas, cobrança, limites, recursos ou feature flags, e sem
 * relacionamento bidirecional (nem Empresa nem Produto referenciam a lista
 * de licenças).
 *
 * Somente tipos, Rules e API base (GET/POST) nesta etapa — sem PATCH,
 * DELETE, histórico ou renovação.
 */
import type { Timestamp } from "firebase-admin/firestore";

export type GlobalLicencaStatus = "ATIVA" | "SUSPENSA" | "EXPIRADA";

/**
 * Entidade persistida em globalLicencas/{licencaId}. Somente estes campos —
 * nenhum campo além do especificado nesta fase.
 */
export type GlobalLicenca = {
  empresaId: string;
  produtoId: string;
  status: GlobalLicencaStatus;
  inicioVigencia: Timestamp;
  fimVigencia?: Timestamp | null;

  /** Controle de concorrência otimista, mesmo padrão das demais entidades globais. Inicia em 1. */
  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid: string;
  updatedByUid: string;
};

/**
 * DTO de entrada para criação (POST /api/global/licencas — G1.7.1).
 * Datas em ISO 8601 (string); convertidas para Timestamp no servidor.
 */
export type CreateGlobalLicencaInput = {
  empresaId: string;
  produtoId: string;
  status?: GlobalLicencaStatus;
  inicioVigencia: string;
  fimVigencia?: string | null;
};
