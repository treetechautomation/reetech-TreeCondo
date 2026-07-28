/**
 * FASE D.3 — POLICY ENGINE — TIPOS (contrato único do domínio de políticas).
 *
 * Módulo puro: nenhum import de Firebase, nenhum I/O.
 * Reservas permanece congelado — nada aqui é consumido por APIs nesta fase.
 */

// ── Primitivos ───────────────────────────────────────────────────────────────

/** Data civil no formato YYYY-MM-DD (fuso oficial America/Sao_Paulo). */
export type ISODate = string;
/** Timestamp ISO-8601 completo. */
export type ISOTimestamp = string;
/** Dia/mês recorrente no formato MM-DD. */
export type MonthDay = string;

export type ReservaAction =
  | "CREATE"
  | "CANCEL"
  | "QUEUE_JOIN"
  | "QUEUE_LEAVE"
  | "QUEUE_PROMOTE"
  | "OFFER_ACCEPT"
  | "OFFER_REJECT"
  | "APPROVE"
  | "GUEST_LIST_EDIT"
  | "CHECK_IN"
  | "CAMPO_REGISTRAR"
  | "USO_COMUM_CONVIDADO_ADICIONAR";

/** Nível de origem de cada campo da política resolvida (hierarquia D.2). */
export type PolicyLevel = "OPCAO" | "AREA" | "CONDOMINIO" | "DEFAULT";

/** Prioridade de regra (ajuste obrigatório D.3 §3). */
export type RulePriority = "BLOCKER" | "VALIDATION" | "WARNING" | "INFO";

export type PolicyTargetRef = {
  condominioId: string;
  areaId: string;
  opcaoId?: string;
};

export type HolidayMode = "BLOCK" | "ALLOW" | "SPECIAL_FEE";

// ── Documento de política ────────────────────────────────────────────────────

export type PolicyDocument = {
  booking: {
    /** Antecedência mínima em horas (0 = mesmo dia permitido — comportamento homologado). */
    minAdvanceHours: number;
    /** Antecedência máxima em dias (null = sem horizonte — comportamento homologado). */
    maxAdvanceDays: number | null;
    /** >= N horas até o evento ⇒ auto-aprovação (homologado: 24). */
    autoApproveAfterHours: number;
    /** < N horas até o evento ⇒ exige aprovação (homologado: 24). */
    requireApprovalUnderHours: number;
    /** Sempre false; presente para snapshot explícito. */
    allowPastDates: boolean;
  };
  weekdays: {
    /** 0=domingo … 6=sábado (homologado: [0]). */
    blockedWeekdays: number[];
  };
  holidays: {
    mode: HolidayMode;
    /** Datas fixas MM-DD (homologado: 12-24, 12-25, 12-31, 01-01). */
    fixedDates: MonthDay[];
    /** Feriados móveis via Páscoa: Carnaval, Sexta Santa, Corpus Christi (homologado: false). */
    includeMovable: boolean;
    /** Datas custom por condomínio (YYYY-MM-DD ou MM-DD). */
    custom: Array<{ date: string; label: string; mode: HolidayMode }>;
  };
  schedule: {
    /** Horário é POLÍTICA; o slot continua diário (areaId__YYYY-MM-DD). */
    allDay: boolean;
    startHour: number | null;
    endHour: number | null;
  };
  /** FASE 16.4 — Política de horários do Campo/Quadra (USO_CAMPO). */
  campo: {
    /** Hora de abertura do Campo (0-23). null = sem restrição de início. */
    horaInicio: number | null;
    /** Hora de fechamento do Campo (0-23). null = sem restrição de fim. */
    horaFim: number | null;
    /** Exceção de horário estendido (ex: futebol comunitário até 23h). */
    excecaoHorarioEstendido: {
      habilitada: boolean;
      /** Hora fim da exceção (0-23). null = sem exceção configurada. Só aplicada se habilitada === true. */
      horaFim: number | null;
    };
    /** FASE 16.10 / R2 — Exclusividade vinculada a reserva privativa. */
    exclusividade: {
      /** Ativa a regra de exclusividade para este condomínio. */
      habilitada: boolean;
      /** Dias da semana permitidos (0=domingo … 6=sábado). */
      diasPermitidos: number[];
      /** Hora de início da exclusividade (0-23). null = não configurado. */
      horaInicio: number | null;
      /** Hora de fim da exclusividade (0-23). null = não configurado. */
      horaFim: number | null;
      /** Duração do HOLD em horas. null = sem HOLD. */
      holdHoras: number | null;
    };
  };
  capacity: {
    maxPeople: number | null;
    guestList: {
      required: boolean;
      maxGuests: number | null;
      /** Prazo (horas antes do evento) para entrega/edição da lista. */
      submitDeadlineHours: number;
      lockAfterDeadline: boolean;
    };
  };
  quota: {
    maxPerMonthPerUnit: number | null;
    maxActiveFuturePerUnit: number | null;
    /** Tamanho máximo da fila de espera (homologado: 3). */
    maxQueueSize: number;
  };
  cancellation: {
    /** Janela mínima em horas antes do evento (homologado: 48). */
    minHoursBeforeEvent: number;
    lateCancelAllowed: boolean;
    noShowTrackingEnabled: boolean;
    noShowSuspensionDays: number | null;
    /** Operador pode cancelar fora da janela (comportamento homologado: true). */
    operatorBypass: boolean;
    /** D.11.5: penalidade financeira por no-show (centavos). null = sem penalidade. */
    noShowPenaltyCentavos: number | null;
  };
  financial: {
    /** Exigir quitação/adimplência (homologado: false — não verificado hoje). */
    requiresPaidUpMember: boolean;
    /** null ⇒ herda o preço da área/opção (fato do contexto). */
    feeCentavos: number | null;
    holidayFeeCentavos: number | null;
    /** D.11.5: multa por cancelamento fora da janela (centavos). null = sem multa. */
    lateCancelFeeCentavos: number | null;
  };
  /** D.11.5: check-in na portaria. */
  checkin: {
    required: boolean;
  };
  eligibility: {
    requireActiveMember: boolean;
    scope: "CONDOMINIO" | "BLOCO";
    allowedBlocks: string[] | null;
  };
  queue: {
    /** Duração da oferta FIFO em minutos (homologado: 120). */
    offerDurationMinutes: number;
  };
  /** FASE 16.18 / R6 — Saldo mensal de convidados para uso comum. */
  convidados: {
    /** Habilita o sistema de saldo de convidados. */
    habilitado: boolean;
    /** Saldo mensal de convidados por unidade. null = não configurado. */
    saldoMensalPorUnidade: number | null;
    /** Dia de reinício do saldo (1-28). null = não configurado. R6 v1: somente 1. */
    reinicioDia: number | null;
  };
};

/** Política parcial (o que vive em cada nível: Opção, Área, Condomínio). */
export type PartialPolicy = DeepPartial<PolicyDocument>;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? U[]
    : T[K] extends object | null
      ? T[K] extends null
        ? T[K]
        : DeepPartial<T[K]> | (T[K] extends object ? never : T[K])
      : T[K];
};

/** Proveniência: caminho com pontos (ex.: "cancellation.minHoursBeforeEvent") → nível de origem. */
export type PolicyProvenance = Record<string, PolicyLevel>;

// ── Política resolvida e compilada ───────────────────────────────────────────

export type ResolvedPolicy = {
  policy: PolicyDocument;
  /** Versão publicada do condomínio. 0 = política legada (paridade com o comportamento congelado). */
  version: number;
  target: PolicyTargetRef;
  provenance: PolicyProvenance;
  resolvedAt: ISOTimestamp;
};

/**
 * Política COMPILADA (ajuste obrigatório D.3 §6).
 * O merge acontece uma única vez no compiler; o Validator só trabalha sobre esta estrutura.
 */
export type CompiledPolicy = {
  readonly policy: PolicyDocument;
  readonly version: number;
  readonly target: PolicyTargetRef;
  readonly provenance: PolicyProvenance;
  readonly compiledAt: ISOTimestamp;
  readonly hash: string;
  /** Estruturas pré-computadas para avaliação O(1). */
  readonly blockedWeekdaySet: ReadonlySet<number>;
  readonly blockedFixedDateSet: ReadonlySet<MonthDay>;
  readonly blockedCustomFullDateSet: ReadonlySet<ISODate>;
  readonly blockedCustomMonthDaySet: ReadonlySet<MonthDay>;
};

// ── Snapshot congelado na reserva ────────────────────────────────────────────

export type PolicySnapshot = {
  policyVersion: number;
  policyHash: string;
  policy: PolicyDocument;
  target: PolicyTargetRef;
  /** FASE D.8: rastreabilidade multi-condomínio. */
  condominioId: string;
  frozenAt: ISOTimestamp;
  /** Versão do FORMATO do snapshot (evolução futura sem quebrar leitores). */
  engineSchemaVersion: 1;
};

export type PolicyVersionInfo = {
  version: number;
  publishedAt: ISOTimestamp | null;
};

// ── Fatos (contexto) ─────────────────────────────────────────────────────────

export type MemberFacts = {
  uid: string;
  /** Status bruto do membro (ex.: "ATIVO"); comparação é normalizada pela regra. */
  status: string;
  role: string;
  /** Bloco normalizado (lowercase/trim — mesma normalização do motor congelado). */
  blocoIdNorm: string | null;
  /** D.11.7: Unidade normalizada para identidade da unidade (quotas, inadimplência). */
  unidadeIdNorm: string | null;
  /** Claims super_admin/superAdmin — hoje ignoram o check de membro ativo. */
  isSuperAdmin: boolean;
  /** null = fato indisponível (regra QUITACAO decide conforme a política). */
  isPaidUp: boolean | null;
  recentNoShows: number;
  suspendedUntil: ISODate | null;
  /** Membro existe no condomínio. */
  exists: boolean;
};

/** D.11.7: Chave canônica da unidade para agregações (quotas, inadimplência). */
export type UnitKey = string;

/** Constrói a chave canônica da unidade: condominioId::blocoIdNorm::unidadeIdNorm. */
export function buildUnitKey(condominioId: string, blocoIdNorm: string | null, unidadeIdNorm: string | null): UnitKey {
  return `${condominioId}::${blocoIdNorm ?? ""}::${unidadeIdNorm ?? ""}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// D.11.7 — FACT STATE (consistência de dados)
// ═══════════════════════════════════════════════════════════════════════════════

/** Estado de um fato consultado a fontes externas (Firestore, Financeiro, etc.). */
export type FactState = "KNOWN" | "UNKNOWN" | "ERROR";

/** Fato numérico com estado explícito — previne confusão entre 0-real e 0-placeholder. */
export type FactNumber = {
  value: number;
  state: FactState;
};

/** Fato booleano com estado explícito — null = UNKNOWN/ERROR, true/false = KNOWN. */
export type FactBoolean = {
  value: boolean | null;
  state: FactState;
};

export const FACT_UNKNOWN: FactNumber = { value: 0, state: "UNKNOWN" };
export const FACT_ERROR: FactNumber = { value: 0, state: "ERROR" };

export function factKnown(value: number): FactNumber {
  return { value, state: "KNOWN" };
}

export function createFactBoolean(value: boolean | null, error = false): FactBoolean {
  if (value === null) return { value: null, state: error ? "ERROR" : "UNKNOWN" };
  return { value, state: "KNOWN" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D.11.8 — PAID UP SCOPE (adimplência)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Escopo de verificação de adimplência.
 *
 * MEMBER  — cada morador tem seu próprio status financeiro (atual).
 * UNIT    — inadimplência de qualquer morador afeta toda a unidade (futuro).
 * HOLDER  — apenas o titular financeiro da unidade é verificado (futuro).
 */
export type PaidUpScope = "MEMBER" | "UNIT" | "HOLDER";

export type AreaFacts = {
  ativo: boolean;
};

export type QuotaFacts = {
  monthCountForUnit: number;
  activeFutureForUnit: number;
  queueSizeForSlot: number;
  /** D.11.8: estado da consulta de cota mensal. Ausente = KNOWN (legado). */
  monthCountState?: FactState;
  /** D.11.8: estado da consulta de reservas futuras. */
  activeFutureState?: FactState;
};

export type ReservaFacts = {
  /** Timestamp (ms) do evento — no motor congelado, meio-dia UTC do dateStr. */
  eventMs: number;
  status: string;
  valorCobradoCentavos: number;
};

export type OfferFacts = {
  /** null = oferta sem prazo registrado (comportamento homologado: NÃO expirada). */
  expiresAtMs: number | null;
};

export type PolicyContext = {
  /** Momento da avaliação em ms (Date.now() do chamador). */
  nowMs: number;
  /** Data civil de hoje em America/Sao_Paulo (YYYY-MM-DD). */
  today: ISODate;
  /** Dia do slot alvo (YYYY-MM-DD). */
  dateStr: ISODate;
  target: PolicyTargetRef;
  actor: MemberFacts;
  area: AreaFacts;
  quota: QuotaFacts;
  /** Preço-fato da área/opção em centavos (fonte: motor congelado). */
  priceCentavos: number;
  /** Ação executada por operador (síndico/admin) — habilita bypasses homologados. */
  isOperatorAction: boolean;
  reserva?: ReservaFacts;
  offer?: OfferFacts;
  guestCount?: number;
  /** D.11.5: check-in de portaria concluído para esta reserva. */
  checkinCompleted?: boolean;
  /** FASE 16.5.2 — intervalo solicitado para USO_CAMPO (minutos desde meia-noite, 0–1440). */
  campoInicioMin?: number;
  /** FASE 16.5.2 — fim solicitado para USO_CAMPO (minutos desde meia-noite, 0–1440). */
  campoFimMin?: number;
};

// ── Regras ───────────────────────────────────────────────────────────────────

export type RuleCode =
  | "MEMBRO_INATIVO"
  | "AREA_INATIVA"
  | "BLOCO_NAO_PERMITIDO"
  | "DATA_PASSADA"
  | "OFERTA_EXPIRADA"
  | "DIA_SEMANA_BLOQUEADO"
  | "FERIADO_BLOQUEADO"
  | "ANTECEDENCIA_MIN"
  | "ANTECEDENCIA_MAX"
  | "FILA_CHEIA"
  | "LIMITE_MENSAL"
  | "LIMITE_RESERVAS_ATIVAS"
  | "QUITACAO_PENDENTE"
  | "SUSPENSO_NO_SHOW"
  | "CAPACIDADE_EXCEDIDA"
  | "LISTA_CONVIDADOS_LIMITE"
  | "LISTA_CONVIDADOS_PRAZO"
  | "CANCELAMENTO_TARDIO"
  // ── D.11.5 — NOVOS RULE CODES ──
  | "CANCELAMENTO_MULTA"
  | "LISTA_CONVIDADOS_OBRIGATORIA"
  | "LISTA_CONVIDADOS_BLOQUEIO"
  | "CHECKIN_OBRIGATORIO"
  | "NO_SHOW_PENALIDADE"
  | "JANELA_HORARIA"
  | "DATA_BLOQUEADA_ADMIN"
  // ── FASE 16.4 — USO_CAMPO ──
  | "CAMPO_FORA_HORARIO"
  // ── FASE 16.10 / R2 — EXCLUSIVIDADE ──
  | "CAMPO_EXCLUSIVIDADE_DIA_INVALIDO"
  | "CAMPO_EXCLUSIVIDADE_SOBREPOSICAO"
  // ── FASE 16.18 / R6 — CONVIDADOS ──
  | "SALDO_CONVIDADOS_EXCEDIDO";

export type RuleOutcome = "PASS" | "FAIL" | "SKIP";

export type RuleResult = {
  code: RuleCode;
  outcome: RuleOutcome;
  priority: RulePriority;
  message: string;
  /** Valor da política efetivamente utilizado na decisão (para explain/auditoria). */
  valueUsed?: unknown;
  details?: Record<string, unknown>;
};

/** Avaliador puro e síncrono: todo I/O acontece antes, na montagem do contexto. */
export type RuleEvaluator = (policy: CompiledPolicy, ctx: PolicyContext) => RuleResult;

/** Entrada do catálogo (registro puro — sem lógica). */
export type RuleDescriptor = {
  code: RuleCode;
  title: string;
  /** Referência do regulamento; numeração de artigos será mapeada na D.6. */
  article: string;
  priority: RulePriority;
  appliesTo: ReadonlyArray<ReservaAction>;
  /** Caminho da política usado pela regra (para proveniência no explain). */
  policyPath: string | null;
  evaluate: RuleEvaluator;
};

// ── Resultado da validação ───────────────────────────────────────────────────

export type FinancialDecision = {
  feeCentavos: number;
  /** hasFee ⇒ reserva nasce PENDENTE_PAGAMENTO (comportamento homologado). */
  requiresPaymentBeforeApproval: boolean;
  cancellationOutcome: "REFUND" | "KEEP_FEE" | "PARTIAL" | "NOT_APPLICABLE";
  penaltyCentavos: number;
};

export type ValidationResult = {
  allowed: boolean;
  /** Apenas FAILs que impedem a ação (BLOCKER/VALIDATION). */
  violations: RuleResult[];
  /** Avisos não impeditivos (WARNING/INFO). */
  warnings: RuleResult[];
  /** Trilha completa de avaliação, na ordem executada (auditoria). */
  results: RuleResult[];
  /** true ⇒ interrompido por BLOCKER (regras seguintes não avaliadas). */
  haltedByBlocker: boolean;
  /** Substitui a lógica reimplementada de aprovação (criar/route.ts:161-166). */
  requiresApproval: boolean;
  financial: FinancialDecision;
};

export type RuleExplanation = {
  article: string;
  ruleCode: RuleCode;
  ruleTitle: string;
  outcome: RuleOutcome;
  priority: RulePriority;
  valueUsed: unknown;
  /** Origem hierárquica do valor da política (Opção/Área/Condomínio/Default). */
  origin: PolicyLevel | null;
  message: string;
};

// ── Porta de I/O (Repository) ────────────────────────────────────────────────

export type PolicyRepository = {
  getPublishedVersion(condominioId: string): Promise<PolicyVersionInfo>;
  getCondominioPolicy(condominioId: string): Promise<PartialPolicy | null>;
  getAreaPolicy(condominioId: string, areaId: string): Promise<PartialPolicy | null>;
  getOpcaoPolicy(
    condominioId: string,
    areaId: string,
    opcaoId: string
  ): Promise<PartialPolicy | null>;
  getMemberFacts(condominioId: string, uid: string): Promise<MemberFacts>;
    getQuotaFacts(
      condominioId: string,
      query: { areaId: string; dateStr: ISODate; uid: string; unidadeIdNorm?: string | null }
    ): Promise<QuotaFacts>;
};

/** Forma mínima de uma reserva para recuperação de política (compat legado). */
export type ReservaLike = {
  policyVersion?: number | null;
  policySnapshot?: PolicySnapshot | null;
  areaId?: string | null;
  condominioId?: string | null;
  opcaoId?: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// FASE D.8 — REGULAMENTO MULTI-CONDOMÍNIO
// ═══════════════════════════════════════════════════════════════════════════════

/** Categorias de regras do regulamento. */
export type RuleCategory =
  | "ELEGIBILIDADE"
  | "ANTECEDENCIA"
  | "HORARIOS"
  | "CAPACIDADE"
  | "QUOTAS"
  | "CANCELAMENTO"
  | "FINANCEIRO"
  | "FILA";

/** Um artigo do regulamento (ex.: "Artigo 14 — Reserva do salão"). */
export type RegulamentoArtigo = {
  /** Número ou código do artigo (ex.: "14", "14-A"). */
  artigo: string;
  /** Título descritivo. */
  titulo: string;
  /** Texto completo do artigo. */
  descricao: string;
  /** Categoria a que pertence. */
  categoria: RuleCategory;
  /** Artigos podem ser desativados sem perder o histórico. */
  ativo: boolean;
};

/** Uma regra individual atrelada a um artigo. */
export type RegulamentoRegra = {
  /** RuleCode do catálogo do engine. */
  code: string;
  /** Artigo ao qual pertence. */
  artigo: string;
  /** Categoria. */
  categoria: RuleCategory;
  /** Prioridade. */
  prioridade: "BLOQUEANTE" | "VALIDACAO" | "AVISO" | "INFORMATIVO";
  /** Mensagem exibida ao usuário quando a regra bloqueia. */
  mensagem: string;
  /** Valor configurado (ex.: 24 horas, 3 vagas, ["12-25"]). */
  valor: unknown;
  /** Origem hierárquica: COND/AREA/OPCAO. */
  origem: "CONDOMINIO" | "AREA" | "OPCAO";
};

/** Metadados de versionamento de um regulamento. */
export type RegulamentoVersionInfo = {
  /** Número sequencial da versão (> 0). */
  version: number;
  /** ISO-8601 da publicação. */
  publishedAt: ISOTimestamp;
  /** UID do autor/admin que publicou. */
  authorUid: string;
  /** Nome do autor para exibição. */
  authorNome: string;
  /** Hash SHA-like do conteúdo completo (integridade). */
  contentHash: string;
  /** Observação / changelog da versão. */
  observacao: string;
  /** Status: RASCUNHO, PUBLICADA, REVOGADA. */
  status: "RASCUNHO" | "PUBLICADA" | "REVOGADA";
};

/** Estrutura completa de um regulamento (documento Firestore). */
export type RegulamentoDocument = {
  /** condominioId dono do regulamento. */
  condominioId: string;
  /** Versão atual publicada. */
  currentVersion: number;
  /** Data da última publicação. */
  publishedAt: ISOTimestamp | null;
  /** Histórico de versões (mais recente primeiro). */
  history: RegulamentoVersionInfo[];
  /** Artigos do regulamento. */
  artigos: RegulamentoArtigo[];
  /** Regras individuais. */
  regras: RegulamentoRegra[];
  /** Política compilada (PolicyDocument) correspondente à versão atual. */
  policy: PolicyDocument;
  /** Política parcial com sobreposições por área. */
  areaOverrides?: Record<string, PartialPolicy>;
  /** Política parcial com sobreposições por opção. */
  opcaoOverrides?: Record<string, Record<string, PartialPolicy>>;
  /** CondominioId de origem (se clonado de outro regulamento). */
  clonedFrom?: string | null;
  /** Timestamps. */
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
};

/** Formato de exportação de regulamento (JSON portável). */
export type RegulamentoExport = {
  /** Versão do schema de exportação. */
  schemaVersion: 1;
  /** Metadados de origem. */
  exportedAt: ISOTimestamp;
  exportedBy: string;
  sourceCondominioId: string;
  /** Dados do regulamento. */
  regulamento: Omit<RegulamentoDocument, "condominioId" | "createdAt" | "updatedAt">;
  /** Hash de integridade do conteúdo. */
  contentHash: string;
};

/** Resultado da validação de importação. */
export type RegulamentoImportValidation = {
  valid: boolean;
  /** Versão do regulamento importado. */
  importedVersion: number;
  /** Lista de avisos (ex.: artigos com códigos desconhecidos). */
  warnings: string[];
  /** Lista de erros (ex.: schema incompatível, hash quebrado). */
  errors: string[];
  /** Política resolvida após merge (se valid=true). */
  resolvedPolicy?: PolicyDocument;
};

/** Parâmetros para clonagem de regulamento. */
export type RegulamentoCloneParams = {
  /** condominioId de origem. */
  sourceCondominioId: string;
  /** condominioId de destino. */
  targetCondominioId: string;
  /** Nome do autor da clonagem. */
  authorUid: string;
  authorNome: string;
  /** Observação. */
  observacao: string;
  /** Sobrescrever regulamento existente no destino? */
  overwrite: boolean;
};

/** Resultado da operação de clonagem. */
export type RegulamentoCloneResult = {
  success: boolean;
  targetVersion: number;
  /** Lista de diferenças em relação ao original (para auditoria). */
  differences: string[];
  /** Hash do regulamento clonado. */
  contentHash: string;
};

/** Modo de herança entre níveis. */
export type HerancaMode =
  | "INHERIT" // herda do nível superior
  | "OVERRIDE" // sobrescreve campo(s) específico(s)
  | "EXTEND" // adiciona ao que já existe (ex.: datas adicionais)
  | "REPLACE"; // substitui completamente

/** Configuração de herança para um nível hierárquico. */
export type HerancaConfig = {
  /** Modo de herança padrão para campos não especificados. */
  defaultMode: HerancaMode;
  /** Overrides por path (ex.: "cancellation.minHoursBeforeEvent" → OVERRIDE). */
  fieldOverrides?: Record<string, HerancaMode>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// FASE D.9 — ADMINISTRAÇÃO DE REGULAMENTOS (CRUD + CICLO DE VIDA)
// ═══════════════════════════════════════════════════════════════════════════════

/** Papéis com permissão para administrar regulamentos. */
export type RegulamentoAdminRole = "SUPER_ADMIN" | "ADMIN_CONDOMINIO";

/** Contexto de autenticação para operações administrativas. */
export type RegulamentoAuthContext = {
  uid: string;
  role: RegulamentoAdminRole;
  nome: string;
  /** condominioId que o admin está administrando. */
  condominioId: string;
};

/** Status de uma operação do ciclo de vida. */
export type OperacaoStatus = {
  success: boolean;
  message: string;
  /** Versão afetada (quando aplicável). */
  version?: number;
  /** Hash do conteúdo (quando aplicável). */
  contentHash?: string;
};

/** Parâmetros para criar/editar um rascunho de regulamento. */
export type RegulamentoDraftInput = {
  /** Política completa ou parcial. */
  policy: PartialPolicy;
  /** Artigos do regulamento. */
  artigos?: RegulamentoArtigo[];
  /** Regras individuais. */
  regras?: RegulamentoRegra[];
  /** Sobrescritas por área. */
  areaOverrides?: Record<string, PartialPolicy>;
  /** Sobrescritas por opção. */
  opcaoOverrides?: Record<string, Record<string, PartialPolicy>>;
};

/** Resultado da validação de um rascunho. */
export type RegulamentoDraftValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Política resolvida após merge de todos os níveis. */
  resolvedPolicy?: PolicyDocument;
};

/** Parâmetros para publicação de um regulamento. */
export type PublishPolicyParams = {
  condominioId: string;
  /** Observação / changelog da publicação. */
  observacao: string;
  /** Autor da publicação. */
  author: RegulamentoAuthContext;
};

/** Resultado da publicação. */
export type PublishPolicyResult = OperacaoStatus & {
  /** Versão publicada. */
  version: number;
  /** Política compilada publicada. */
  policy: PolicyDocument;
  /** Snapshot congelado para novas reservas. */
  snapshot: PolicySnapshot;
};

/** Parâmetros para revogação. */
export type RevokePolicyParams = {
  condominioId: string;
  observacao: string;
  author: RegulamentoAuthContext;
};

/** Resultado da exportação. */
export type ExportPolicyResult = {
  success: boolean;
  data: RegulamentoExport | null;
  error?: string;
};

/** Resultado da importação. */
export type ImportPolicyResult = {
  success: boolean;
  validation: RegulamentoImportValidation;
  /** ID do rascunho criado (importação nunca publica). */
  draftVersion?: number;
};

/** Parâmetros para clonagem (D.9 — expandido). */
export type ClonePolicyParams = {
  sourceCondominioId: string;
  targetCondominioId: string;
  author: RegulamentoAuthContext;
  observacao: string;
  /** Sobrescrever rascunho existente no destino. */
  overwrite: boolean;
};

/** Resultado da clonagem. */
export type ClonePolicyResult = {
  success: boolean;
  /** Versão do rascunho criado no destino. */
  draftVersion?: number;
  contentHash: string;
  /** Lista de diferenças em relação ao original. */
  differences: string[];
  error?: string;
};
