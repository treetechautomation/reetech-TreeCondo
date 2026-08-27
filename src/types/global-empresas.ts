/**
 * G1.6.5 — Tipos da entidade global Empresa (Painel Global Treetech).
 *
 * Fundação da entidade Empresa na hierarquia Treetech → Produto → Cliente →
 * Empresa → Condomínio → Usuários. Nesta fase não há nenhum relacionamento
 * com Cliente, Condomínio ou Produto — apenas a entidade isolada, seguindo o
 * mesmo padrão estrutural de GlobalCliente (G1.6.1).
 *
 * Somente tipos e API base (GET/POST) nesta etapa — sem PATCH, histórico ou
 * qualquer vínculo automático.
 */
import type { Timestamp } from "firebase-admin/firestore";

export type GlobalEmpresaStatus = "TRIAL" | "ATIVO" | "SUSPENSO" | "CANCELADO";

/**
 * Entidade persistida em globalEmpresas/{empresaId}.
 */
export type GlobalEmpresa = {
  nome: string;
  nomeBusca: string;
  documento?: string;
  documentoNormalizado?: string;
  cidade?: string;
  cidadeBusca?: string;
  uf?: string;

  status: GlobalEmpresaStatus;

  /** Controle de concorrência otimista, seguindo o padrão de GlobalCliente. Inicia em 1. */
  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid: string;
  updatedByUid: string;
};

/**
 * DTO de entrada para criação (POST /api/global/empresas — G1.6.5).
 * Sem campos derivados (nomeBusca) ou imutáveis (createdAt, createdByUid etc.).
 */
export type CreateGlobalEmpresaInput = {
  nome: string;
  documento?: string;
  cidade?: string;
  uf?: string;
  status?: GlobalEmpresaStatus;
};
