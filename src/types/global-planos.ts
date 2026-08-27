/**
 * G1.7.2 — Tipos da entidade global Plano (Painel Global Treetech).
 *
 * Plano é a fundação da hierarquia:
 *
 *   Produto
 *     ↓
 *   Plano
 *
 * Ex.: TreeCondo → Starter/Professional/Enterprise; TreeMídia →
 * Basic/Business/Corporate. Plano pertence EXCLUSIVAMENTE ao Produto —
 * Empresa, Licença e Cliente não apontam para Plano nesta fase, e
 * Assinatura não existe. Sem relacionamento adicional.
 *
 * Somente tipos, Rules e API base (GET/POST) nesta etapa — sem PATCH,
 * DELETE, histórico, assinaturas, recursos, limites, cobrança, preços,
 * trial, upgrade/downgrade ou feature flags. Nenhum seed automático.
 */
import type { Timestamp } from "firebase-admin/firestore";

export type GlobalPlanoStatus = "ATIVO" | "INATIVO";

/**
 * Entidade persistida em globalPlanos/{planoId}. Somente estes campos —
 * nenhum campo além do especificado nesta fase.
 */
export type GlobalPlano = {
  produtoId: string;
  codigo: string;
  nome: string;
  descricao?: string;
  status: GlobalPlanoStatus;
  ordem: number;

  /** Controle de concorrência otimista, mesmo padrão das demais entidades globais. Inicia em 1. */
  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid: string;
  updatedByUid: string;
};

/**
 * DTO de entrada para criação (POST /api/global/planos — G1.7.2).
 * Sem campos imutáveis (createdAt, createdByUid etc.).
 */
export type CreateGlobalPlanoInput = {
  produtoId: string;
  codigo: string;
  nome: string;
  descricao?: string;
  status?: GlobalPlanoStatus;
  ordem: number;
};
