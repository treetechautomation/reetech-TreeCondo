/**
 * F.2.6 — TIPOS CANÔNICOS DO DOMÍNIO PESSOA
 *
 * Contrato único para: Pessoa, Membro, Vinculo, Role, AccessLink.
 * Todas as referências anteriores devem convergir para este arquivo.
 */

export type PersonStatus = "ATIVO" | "INATIVO";

export type PersonOrigin = "CADASTRO_MANUAL" | "IMPORTACAO" | "CONVITE" | "SELF_ONBOARDING";

export type VinculoRole =
  | "ADMIN_CONDOMINIO"
  | "SINDICO"
  | "ADMIN"
  | "MORADOR"
  | "PORTEIRO"
  | "ZELADOR"
  | "SEGURANCA";

export interface Vinculo {
  condominioId: string;
  role: VinculoRole;
  blocoId?: string | null;
  unidadeId?: string | null;
  unitDocId?: string | null;
  condominioNome?: string | null;
  status: "ATIVO" | "INATIVO";
}

export type RoleKey =
  | "SUPER_ADMIN"
  | "SINDICO"
  | "ADMIN"
  | "ADMIN_CONDOMINIO"
  | "PORTEIRO"
  | "ZELADOR"
  | "MORADOR"
  | "FUNCIONARIO";

export type TipoVinculo = "PROPRIETARIO" | "INQUILINO" | "MORADOR_PERMANENTE" | "DEPENDENTE";

export type AccessStatus = "SEM_ACESSO" | "PENDENTE_VINCULO" | "VINCULADO" | "BLOQUEADO";

export type ModoAcesso = "SELF_ONBOARDING" | "CONVITE_CODIGO";

export interface PersonData {
  id?: string;
  condominioId: string;
  nome: string;
  email?: string | null;
  emailNorm?: string | null;
  telefone?: string | null;
  status: PersonStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  metadata?: {
    origem?: PersonOrigin;
  };
}

export interface PersonCreatePayload {
  condominioId: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  metadata?: { origem?: PersonOrigin };
}

export interface PersonUpdatePayload {
  nome?: string;
  email?: string | null;
  telefone?: string | null;
  status?: PersonStatus;
}

export interface LinkMembershipPayload {
  condominioId: string;
  personId: string;
  uid: string;
}

export interface LinkMembershipResult {
  ok: boolean;
  personId: string;
  uid: string;
  condominioId: string;
  alreadyLinked?: boolean;
  error?: string;
}

export interface AdminPersonPayload {
  condominioId: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  blocoId?: string | null;
  unitDocId?: string | null;
  tipoVinculo?: TipoVinculo | null;
  permitirAcessoApp?: boolean;
  modoAcesso?: ModoAcesso | null;
}

export interface AdminPersonResult {
  ok: boolean;
  personId?: string;
  linkId?: string;
  conviteId?: string;
  accessStatus?: AccessStatus;
  mode?: string;
  error?: string;
}

export const VALID_PERSON_STATUS: PersonStatus[] = ["ATIVO", "INATIVO"];
export const VALID_PERSON_ORIGINS: PersonOrigin[] = ["CADASTRO_MANUAL", "IMPORTACAO", "CONVITE", "SELF_ONBOARDING"];
export const VALID_ACCESS_STATUS: AccessStatus[] = ["SEM_ACESSO", "PENDENTE_VINCULO", "VINCULADO", "BLOQUEADO"];
export const VALID_TIPOS_VINCULO: TipoVinculo[] = ["PROPRIETARIO", "INQUILINO", "MORADOR_PERMANENTE", "DEPENDENTE"];
export const VALID_MODOS_ACESSO: ModoAcesso[] = ["SELF_ONBOARDING", "CONVITE_CODIGO"];

export const SELF_ONBOARDING_ROLES: VinculoRole[] = ["MORADOR"];
export const PRIVILEGED_ROLES: VinculoRole[] = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "PORTEIRO", "ZELADOR", "SEGURANCA"];
