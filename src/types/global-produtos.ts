/**
 * G1.7 — Tipos da entidade global Produto (Painel Global Treetech).
 *
 * Produto é uma entidade independente na hierarquia Treetech → Produto →
 * Empresa → Cliente → Condomínio → Usuário. Nesta fase é apenas a fundação:
 * sem nenhum relacionamento com Empresa/Cliente/Condomínio, sem
 * licenciamento, planos, assinaturas, recursos ou feature flags.
 *
 * Somente tipos, Rules e API base (GET/POST) nesta etapa — sem PATCH,
 * DELETE ou histórico.
 */
import type { Timestamp } from "firebase-admin/firestore";

export type GlobalProdutoStatus = "ATIVO" | "INATIVO";

export type GlobalProdutoCategoria =
  | "CONDOMINIO"
  | "MIDIA"
  | "FINANCEIRO"
  | "SAUDE"
  | "ESPORTE"
  | "OUTRO";

/**
 * Entidade persistida em globalProdutos/{produtoId}. Somente estes campos —
 * nenhum campo além do especificado nesta fase.
 */
export type GlobalProduto = {
  codigo: string;
  nome: string;
  descricao?: string;
  status: GlobalProdutoStatus;
  categoria: GlobalProdutoCategoria;
  versaoAtual?: string;

  /** Controle de concorrência otimista, mesmo padrão de GlobalCliente/GlobalEmpresa. Inicia em 1. */
  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid: string;
  updatedByUid: string;
};

/**
 * DTO de entrada para criação (POST /api/global/produtos — G1.7).
 * Sem campos imutáveis (createdAt, createdByUid etc.).
 */
export type CreateGlobalProdutoInput = {
  codigo: string;
  nome: string;
  descricao?: string;
  status?: GlobalProdutoStatus;
  categoria: GlobalProdutoCategoria;
  versaoAtual?: string;
};

/**
 * G1.7 (Etapa 6) — lista de referência dos produtos Treetech já homologados.
 * Uso EXCLUSIVAMENTE como constante interna de apoio ao desenvolvimento/QA
 * (ex.: validar manualmente os `codigo` esperados). NÃO é seed automático:
 * nenhuma gravação no Firestore ocorre a partir desta constante, e a API não
 * a usa para validar/restringir o campo `codigo` — Produto é uma entidade
 * independente e novos códigos podem ser cadastrados livremente.
 */
export const PRODUTOS_TREETECH_HOMOLOGADOS = [
  "TREECONDO",
  "TREEMIDIA",
  "TREEFOOD",
  "FINDOMUS",
  "TREEDOCTOR",
  "TREEFUT",
] as const;
