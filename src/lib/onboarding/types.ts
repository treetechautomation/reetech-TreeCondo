/**
 * F.2.5 — SELF-ONBOARDING TYPES
 *
 * Tipos para fluxo de linking entre Pessoa e Unidade
 * com descoberta e claim pelo morador.
 */

export type AccessStatus = "PENDENTE_VINCULO" | "VINCULADO" | "BLOQUEADO";

export type TipoVinculo = "PROPRIETARIO" | "INQUILINO" | "MORADOR_PERMANENTE" | "DEPENDENTE";

export interface AccessLinkData {
  id?: string;
  condominioId: string;
  personId: string;
  email: string;
  emailNorm: string;
  blocoId: string;
  unitDocId: string;
  unidadeId: string;
  unidadeIdNorm: string;
  blocoIdNorm: string;
  roleAcesso: "MORADOR";
  tipoVinculo: TipoVinculo;
  accessStatus: AccessStatus;
  condominioNome: string;
  blocoNome: string;
  unidadeNumero: string;
  claimedByUid: string | null;
  claimedAt: unknown | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CreateAccessLinkPayload {
  condominioId: string;
  personId: string;
  email: string;
  blocoId: string;
  unitDocId: string;
  unidadeId: string;
  unidadeIdNorm: string;
  blocoIdNorm: string;
  roleAcesso: "MORADOR";
  tipoVinculo: TipoVinculo;
  condominioNome: string;
  blocoNome: string;
  unidadeNumero: string;
}

export interface EligibleLink {
  linkId: string;
  condominioId: string;
  condominioNome: string;
  blocoNome: string;
  unidadeNumero: string;
  tipoVinculo: TipoVinculo;
}

export interface ClaimResult {
  ok: boolean;
  condominioId: string;
  personId: string;
  uid: string;
  role: string;
  alreadyLinked?: boolean;
  error?: string;
}

export const VALID_ACCESS_STATUS: AccessStatus[] = [
  "PENDENTE_VINCULO",
  "VINCULADO",
  "BLOQUEADO",
];
