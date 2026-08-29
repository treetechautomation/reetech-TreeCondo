/**
 * ACCESS.3 — TIPOS CANÔNICOS DO DOMÍNIO DE CONTROLE DE ACESSO.
 *
 * Fonte única de verdade para os tipos deste domínio (ver relatório
 * ACCESS.2 para a justificativa arquitetural completa). Nenhuma
 * página/rota deve redeclarar estes shapes — importar daqui.
 *
 * Estrutura Firestore aprovada (ACCESS.2, confirmada pelo arquiteto):
 *   /condominios/{condominioId}/accessAuthorizations/{authorizationId}
 *   /condominios/{condominioId}/accessCredentials/{credentialId}
 *   /condominios/{condominioId}/accessStays/{stayId}
 *   /condominios/{condominioId}/accessEvents/{eventId}
 *   /condominios/{condominioId}/config/accessPolicy
 *
 * MVP (ACCESS.3, correção 1.2 do arquiteto): usagePolicy é sempre
 * SINGLE_USE. MULTI_USE existe apenas como valor de tipo para não
 * fechar a porta a uma evolução futura — nenhuma API deste gate (nem
 * de gates futuros até nova decisão) deve aceitar/produzir MULTI_USE.
 */

// ─────────────────────────── Enums ───────────────────────────

export const ACCESS_TYPES = ["VISITOR", "SERVICE_PROVIDER", "DELIVERY", "FAMILY"] as const;
export type AccessType = (typeof ACCESS_TYPES)[number];

/**
 * SINGLE_USE é o único valor aceito por qualquer API no MVP (correção
 * 1.2 do arquiteto). MULTI_USE é reservado para uma evolução futura e
 * não deve ser produzido nem aceito por nenhum código até nova decisão
 * arquitetural explícita.
 */
export const USAGE_POLICIES = ["SINGLE_USE", "MULTI_USE"] as const;
export type UsagePolicy = (typeof USAGE_POLICIES)[number];

/**
 * EXPIRADO é deliberadamente ausente aqui — é um estado DERIVADO em
 * tempo de leitura (ACCESS.2, confirmado por `deriveAuthorizationStatus`
 * abaixo), nunca persistido. Persistir apenas os estados que resultam
 * de uma transição real (criação/revogação).
 */
export const AUTHORIZATION_STATUSES = ["AUTORIZADO", "REVOGADO"] as const;
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

/**
 * Descreve a realidade física: a pessoa está fisicamente dentro do
 * condomínio, ou uma saída física foi confirmada por um operador. Não
 * possui um terceiro estado — "não sei" não é modelável aqui por
 * design (ver `WorkflowState` para a dimensão operacional/bookkeeping,
 * que é ortogonal e pode ter incerteza).
 */
export const PHYSICAL_PRESENCE_STATES = ["INSIDE", "EXIT_CONFIRMED"] as const;
export type PhysicalPresenceState = (typeof PHYSICAL_PRESENCE_STATES)[number];

/**
 * Descreve o bookkeeping operacional — nunca a realidade física.
 * AUTO_CLOSED é higiene de workflow (tira a permanência da lista
 * operacional principal), NUNCA prova de saída física (invariante
 * formal, ver `hasUnconfirmedPhysicalExit` em presence.ts).
 *
 * EXIT_OVERDUE é deliberadamente ausente — é derivado em tempo de
 * leitura a partir de `enteredAt` + política do condomínio, nunca
 * persistido (mesma razão de EXPIRADO acima).
 */
export const WORKFLOW_STATES = ["ACTIVE", "AUTO_CLOSED", "CLOSED"] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export const ENTRY_CREDENTIAL_METHODS = ["QR", "PIN"] as const;
export type CredentialMethod = (typeof ENTRY_CREDENTIAL_METHODS)[number];

export const ACCESS_EVENT_TYPES = [
  "AUTHORIZATION_CREATED",
  "AUTHORIZATION_REVOKED",
  "ENTRY_CONFIRMED",
  "EXIT_CONFIRMED",
  "AUTO_CLOSED",
] as const;
export type AccessEventType = (typeof ACCESS_EVENT_TYPES)[number];

// ─────────────────────────── Visitor snapshot ───────────────────────────

/**
 * PII minimizada (ACCESS.2 seção "PII Minimization", confirmada pelo
 * arquiteto na correção 1.2 e no congelamento de campos da seção 9):
 * nome é obrigatório; telefone/placa/observação são opcionais; CPF/RG/
 * documento/email NÃO fazem parte do MVP — omitidos deliberadamente,
 * não "opcionais". Adicionar exigiria nova decisão arquitetural.
 */
export interface VisitorSnapshot {
  nome: string;
  telefone?: string | null;
  placa?: string | null;
  observacao?: string | null;
}

export const VISITOR_SNAPSHOT_LIMITS = {
  nome: 120,
  telefone: 20,
  placa: 12,
  observacao: 280,
} as const;

// ─────────────────────────── AccessAuthorization ───────────────────────────

export interface AccessAuthorization {
  id: string;
  condominioId: string;
  unitId: string;
  blocoId: string | null;
  createdByUid: string;
  accessType: AccessType;
  visitorSnapshot: VisitorSnapshot;

  /** Data civil da visita, "YYYY-MM-DD", sem timezone embutido. */
  visitDate: string;

  /** Puramente informativo — nunca usado em invariante/consulta de elegibilidade. */
  expectedEntryAt: Date | null;
  /** Puramente informativo — NUNCA controla fechamento de permanência (invariante #1). */
  expectedExitAt: Date | null;

  /** Instante absoluto (UTC) a partir do qual uma NOVA entrada é permitida. */
  newEntryValidFrom: Date;
  /** Instante absoluto (UTC) até o qual uma NOVA entrada é permitida. */
  newEntryValidUntil: Date;

  /** Sempre "SINGLE_USE" no MVP (correção 1.2 do arquiteto). */
  usagePolicy: UsagePolicy;

  status: AuthorizationStatus;

  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
  revokedByUid: string | null;
  revocationReason: string | null;
}

// ─────────────────────────── AccessCredential ───────────────────────────

/**
 * Um único documento por autorização (ACCESS.2: QR e PIN identificam a
 * MESMA autorização, não faz sentido modelá-los como entidades
 * separadas). NUNCA lido/listado/escrito pelo cliente (Rule ACCESS.3
 * §26) — server-only em toda a sua superfície.
 */
export interface AccessCredential {
  id: string;
  condominioId: string;
  authorizationId: string;

  /** SHA-256 do token aleatório bruto. O token bruto NUNCA é persistido. */
  qrTokenHash: string | null;

  /**
   * Blind index HMAC-SHA256(chave-servidor, condominioId + ":" + pin).
   * Deliberadamente NÃO é um SHA-256 simples do PIN — ver credential.ts
   * para o threat model completo. Nulo se PIN não estiver habilitado
   * para esta credencial.
   */
  pinLookupHash: string | null;

  pinAttempts: number;
  pinLockedUntil: Date | null;

  createdAt: Date;
}

// ─────────────────────────── AccessStay ───────────────────────────

export interface AccessStay {
  /**
   * ID determinístico == authorizationId (ver credential.ts/stayId
   * design note): sob SINGLE_USE, uma autorização produz no máximo UMA
   * permanência durante toda sua vida (seção 33 do ACCESS.3 — "SINGLE_USE
   * = um único ciclo ENTRADA→SAÍDA"), então usar o próprio
   * authorizationId como ID do documento faz do Firestore a garantia
   * de unicidade (create-if-not-exists), sem depender de uma janela de
   * query-então-write sujeita a corrida.
   */
  id: string;
  condominioId: string;
  unitId: string;
  blocoId: string | null;
  authorizationId: string;

  enteredAt: Date;
  enteredByUid: string;
  entryCredentialMethod: CredentialMethod;

  physicalPresenceState: PhysicalPresenceState;
  workflowState: WorkflowState;

  exitConfirmedAt: Date | null;
  exitConfirmedByUid: string | null;
  exitCredentialMethod: CredentialMethod | null;

  autoClosedAt: Date | null;
  autoCloseReason: string | null;

  visitorSnapshot: Pick<VisitorSnapshot, "nome">;

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────── AccessEvent ───────────────────────────

/** Append-only. Nunca atualizado/removido; sempre escrito pelo servidor. */
export interface AccessEvent {
  id: string;
  condominioId: string;
  unitId: string;
  authorizationId: string;
  stayId: string | null;
  type: AccessEventType;
  actorUid: string;
  actorRole: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

// ─────────────────────────── AccessPolicy ───────────────────────────

/**
 * /condominios/{condominioId}/config/accessPolicy — mesmo padrão de
 * config/reservasPolicy e config/menuPermissions já usados no projeto.
 *
 * requireEntryConfirmation e requireExitConfirmation NÃO são
 * configuráveis (ACCESS.3 §20): confirmação explícita é uma invariante
 * do domínio (invariante #2 do ACCESS.2), não uma opção de tenant —
 * nenhum campo de policy pode permitir violá-la.
 */
export interface AccessPolicy {
  qrEnabled: boolean;
  pinEnabled: boolean;

  /** Minutos após `newEntryValidUntil`/horário esperado antes de considerar a saída "pendente" (derivado, não persistido). */
  pendingExitAfterMinutes: number;

  /** Minutos de permanência em EXIT_OVERDUE antes do fechamento operacional automático. */
  autoCloseAfterMinutes: number;

  /** IANA timezone identifier, ex. "America/Sao_Paulo". */
  timezone: string;
}
