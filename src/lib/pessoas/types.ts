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

/**
 * Categoria de domínio da Pessoa — NUNCA concede autorização (RBAC continua
 * exclusivamente em `role`/`VinculoRole`). Ver `src/lib/pessoas/domain/rules.ts`.
 */
export type CategoriaPessoa =
  | "MORADOR"
  | "SINDICO_PROFISSIONAL"
  | "ADMINISTRADORA"
  | "FUNCIONARIO"
  | "PRESTADOR"
  | "VISITANTE_FIXO"
  | "OUTRO";

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
  /**
   * Dado de domínio, não de autorização — nunca lido por apiGuard/RBAC/ACL.
   * Opcional/retrocompatível: documentos existentes sem este campo permanecem válidos.
   */
  categoriaPessoa?: CategoriaPessoa | null;
  /**
   * Dado de domínio, não de autorização. Cobre também pessoas PERSON_ONLY
   * (sem Vinculo, ver POST /api/pessoas/create-or-update), já que este é o
   * único registro que toda Pessoa possui independentemente de ter acesso ao app.
   * Opcional/retrocompatível: documentos existentes sem este campo permanecem válidos.
   */
  moraNoCondominio?: boolean | null;
  /**
   * P1.0 — Etapa 5. Bloco de atuação/referência operacional da pessoa —
   * NUNCA equivalente a vínculo residencial (ver `blocoId`/`unidadeId` em
   * `Vinculo`, que permanecem a única fonte de residência). Nunca concede
   * autorização, nunca cria Vinculo/accessLink/vinculosUnidades.
   * Referencia apenas `condominios/{condominioId}/blocos/{blocoId}` do
   * próprio condomínio da pessoa. Opcional/retrocompatível.
   */
  blocoAtuacaoId?: string | null;
}

export interface PersonCreatePayload {
  condominioId: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  metadata?: { origem?: PersonOrigin };
  categoriaPessoa?: CategoriaPessoa | null;
  moraNoCondominio?: boolean | null;
  blocoAtuacaoId?: string | null;
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
  categoriaPessoa?: CategoriaPessoa | null;
  moraNoCondominio?: boolean | null;
  blocoAtuacaoId?: string | null;
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
export const VALID_CATEGORIAS_PESSOA: CategoriaPessoa[] = [
  "MORADOR",
  "SINDICO_PROFISSIONAL",
  "ADMINISTRADORA",
  "FUNCIONARIO",
  "PRESTADOR",
  "VISITANTE_FIXO",
  "OUTRO",
];
export const VALID_MODOS_ACESSO: ModoAcesso[] = ["SELF_ONBOARDING", "CONVITE_CODIGO"];

export const SELF_ONBOARDING_ROLES: VinculoRole[] = ["MORADOR"];
export const PRIVILEGED_ROLES: VinculoRole[] = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "PORTEIRO", "ZELADOR", "SEGURANCA"];
