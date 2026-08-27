/**
 * G1.6.1 — Tipos da entidade global Cliente (Painel Global Treetech).
 *
 * Cliente é a entidade comercial, separada de Condomínio (entidade operacional
 * existente em condominios/{condominioId}). Vínculo via condominioIds (Modelo A,
 * decidido na G1.6.0) — nenhum documento de condominios é alterado por este tipo.
 *
 * Somente tipos nesta etapa — nenhuma regra de negócio, API, service ou hook.
 *
 * G1.6.6 — fundação do vínculo Empresa → Cliente: `empresaId` opcional,
 * gerenciado exclusivamente por PATCH /api/global/clientes/[id]/empresa (não
 * pelo PATCH genérico do cliente). Relacionamento unidirecional: o Cliente
 * aponta para a Empresa; a Empresa não mantém lista de clientes.
 */
import type { Timestamp } from "firebase-admin/firestore";

export type GlobalClienteStatus = "TRIAL" | "ATIVO" | "SUSPENSO" | "CANCELADO";

/**
 * Entidade persistida em globalClientes/{clienteId}.
 */
export type GlobalCliente = {
  nome: string;
  nomeBusca: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  uf?: string;

  cidadeNorm?: string;
  ufNorm?: string;
  documentoNorm?: string;

  status: GlobalClienteStatus;

  condominioIds: string[];
  produtoIds: string[];

  /**
   * G1.6.6 — vínculo com globalEmpresas/{empresaId}. `undefined`/ausente e
   * `null` são equivalentes (sem empresa vinculada). Gerenciado somente pela
   * rota dedicada PATCH /api/global/clientes/[id]/empresa.
   */
  empresaId?: string | null;

  observacoes?: string;

  /** Controle de concorrência otimista (G1.6.2). Inicia em 1, incrementado a cada PATCH (G1.6.3+). */
  version: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid: string;
  updatedByUid: string;
};

/**
 * DTO de entrada para criação (POST /api/global/clientes — G1.6.2+).
 * Sem campos derivados (nomeBusca) ou imutáveis (createdAt, createdByUid etc.).
 */
export type CreateGlobalClienteInput = {
  nome: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  status?: GlobalClienteStatus;
  condominioIds?: string[];
  produtoIds?: string[];
  observacoes?: string;
  cidade?: string;
  uf?: string;
};

/**
 * DTO de entrada para atualização (PATCH /api/global/clientes/[clienteId] — G1.6.2+).
 * Não permite alterar createdAt, createdByUid ou identificadores internos.
 */
export type UpdateGlobalClienteInput = {
  nome?: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  status?: GlobalClienteStatus;
  condominioIds?: string[];
  produtoIds?: string[];
  observacoes?: string;
  cidade?: string;
  uf?: string;
};
