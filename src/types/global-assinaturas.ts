/**
 * G1.7.3 — Tipos da entidade global Assinatura (Painel Global Treetech).
 *
 * Assinatura conecta comercialmente:
 *
 *   Empresa
 *     ↓
 *   Assinatura
 *     ↓
 *   Plano
 *     ↓
 *   Produto
 *
 * Não substitui globalLicencas. Princípio arquitetural:
 *   - Licença responde: "esta Empresa está autorizada a utilizar este
 *     Produto?"
 *   - Assinatura responde: "qual Plano desse Produto a Empresa contratou e
 *     durante qual período?"
 * Licença ≠ Assinatura — responsabilidades não duplicadas.
 *
 * A Assinatura é a única entidade a conter os quatro IDs (empresaId,
 * produtoId, planoId, licencaId) — nenhum array é criado em Empresa,
 * Produto, Plano ou Licença. Sem relacionamento bidirecional.
 *
 * Somente tipos, Rules e API base (GET/POST) nesta etapa — sem PATCH,
 * DELETE, histórico, renovação, troca de plano, cancelamento, cobrança,
 * preços, desconto, cupom, moeda, periodicidade, limite, recurso, feature
 * flag ou trial.
 */
import type { Timestamp } from "firebase-admin/firestore";

/** Somente estes três — TRIAL/CANCELADA/EXPIRADA/PENDENTE/INADIMPLENTE pertencem a fases futuras. */
export type GlobalAssinaturaStatus = "ATIVA" | "SUSPENSA" | "ENCERRADA";

/**
 * Entidade persistida em globalAssinaturas/{assinaturaId}. Somente estes
 * campos — nenhum campo além do especificado nesta fase.
 */
export type GlobalAssinatura = {
  empresaId: string;
  produtoId: string;
  planoId: string;
  licencaId: string;

  status: GlobalAssinaturaStatus;

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
 * DTO de entrada para criação (POST /api/global/assinaturas — G1.7.3).
 * Datas em ISO 8601 (string); convertidas para Timestamp no servidor.
 */
export type CreateGlobalAssinaturaInput = {
  empresaId: string;
  produtoId: string;
  planoId: string;
  licencaId: string;
  status?: GlobalAssinaturaStatus;
  inicioVigencia: string;
  fimVigencia?: string | null;
};
