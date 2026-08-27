/**
 * G1.7.5 — Tipos da entidade global Recurso (Painel Global Treetech).
 *
 * Catálogo de capacidades que um Produto pode oferecer (ex.: TreeCondo →
 * RESERVAS_AVANCADAS, CONTROLE_ACESSO). Recurso pertence EXCLUSIVAMENTE ao
 * Produto (produtoId) — mesmo padrão estrutural de GlobalPlano (G1.7.2).
 *
 * Definido em G1.7.4 (design arquitetural): Recurso é o catálogo; a
 * concessão/contratação ("recursos contratados") é uma entidade futura e
 * distinta (globalRecursosContratados, não implementada nesta fase).
 *
 * Sem relacionamento com Empresa, Cliente, Licença, Plano ou Assinatura
 * nesta fase. Sem concessão, consumo, limites, contadores, feature flags,
 * cobrança, upgrade/downgrade ou renovação.
 *
 * Somente tipos, Rules e API base (GET/POST) nesta etapa — sem PATCH,
 * DELETE ou histórico. Nenhum seed automático.
 */
import type { Timestamp } from "firebase-admin/firestore";

export type GlobalRecursoStatus = "ATIVO" | "INATIVO";

/**
 * Entidade persistida em globalRecursos/{recursoId}. Somente estes campos —
 * nenhum campo além do especificado nesta fase.
 */
export type GlobalRecurso = {
  produtoId: string;
  codigo: string;
  nome: string;
  descricao?: string;
  status: GlobalRecursoStatus;

  /** Controle de concorrência otimista, mesmo padrão das demais entidades globais. Inicia em 1. */
  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid: string;
  updatedByUid: string;
};

/**
 * DTO de entrada para criação (POST /api/global/recursos — G1.7.5).
 * Sem campos imutáveis (createdAt, createdByUid etc.).
 */
export type CreateGlobalRecursoInput = {
  produtoId: string;
  codigo: string;
  nome: string;
  descricao?: string;
  status?: GlobalRecursoStatus;
};
