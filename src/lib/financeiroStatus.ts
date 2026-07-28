/**
 * Módulo puro de estados e transições do lançamento financeiro de reservas.
 *
 * O TreeCondo NÃO recebe pagamentos.
 * O ciclo de vida controla o trâmite do lançamento até a administradora,
 * que efetivamente debita o valor no boleto condominial.
 *
 * CLASSIFICAÇÃO: módulo de fundação — sem dependências de React, Firebase ou Next.
 */

export enum FinanceiroStatus {
  AGUARDANDO_ENVIO = "AGUARDANDO_ENVIO",
  ENVIADO_ADMINISTRADORA = "ENVIADO_ADMINISTRADORA",
  PROCESSANDO = "PROCESSANDO",
  LANCADO_BOLETO = "LANCADO_BOLETO",
  QUITADO = "QUITADO",
  CANCELADO = "CANCELADO",
  ISENTO = "ISENTO",
  ESTORNADO = "ESTORNADO",
}

export type FinanceiroStatusType = `${FinanceiroStatus}`;

const transicoes: Record<FinanceiroStatus, FinanceiroStatus[]> = {
  [FinanceiroStatus.AGUARDANDO_ENVIO]: [
    FinanceiroStatus.ENVIADO_ADMINISTRADORA,
    FinanceiroStatus.CANCELADO,
    FinanceiroStatus.ISENTO,
  ],
  [FinanceiroStatus.ENVIADO_ADMINISTRADORA]: [
    FinanceiroStatus.PROCESSANDO,
    FinanceiroStatus.CANCELADO,
  ],
  [FinanceiroStatus.PROCESSANDO]: [
    FinanceiroStatus.LANCADO_BOLETO,
    FinanceiroStatus.CANCELADO,
  ],
  [FinanceiroStatus.LANCADO_BOLETO]: [
    FinanceiroStatus.QUITADO,
    FinanceiroStatus.CANCELADO,
    FinanceiroStatus.ESTORNADO,
  ],
  [FinanceiroStatus.QUITADO]: [
    FinanceiroStatus.ESTORNADO,
  ],
  [FinanceiroStatus.CANCELADO]: [],
  [FinanceiroStatus.ISENTO]: [],
  [FinanceiroStatus.ESTORNADO]: [],
};

const statusTerminais: FinanceiroStatus[] = [
  FinanceiroStatus.CANCELADO,
  FinanceiroStatus.ISENTO,
];

const statusAtivos: FinanceiroStatus[] = [
  FinanceiroStatus.AGUARDANDO_ENVIO,
  FinanceiroStatus.ENVIADO_ADMINISTRADORA,
  FinanceiroStatus.PROCESSANDO,
  FinanceiroStatus.LANCADO_BOLETO,
  FinanceiroStatus.QUITADO,
];

const statusPendentes: FinanceiroStatus[] = [
  FinanceiroStatus.AGUARDANDO_ENVIO,
  FinanceiroStatus.ENVIADO_ADMINISTRADORA,
  FinanceiroStatus.PROCESSANDO,
  FinanceiroStatus.LANCADO_BOLETO,
];

export interface LancamentoFinanceiro {
  tipo: "TAXA_RESERVA";
  reservaId: string;
  numeroReserva: string;
  moradorUid: string;
  moradorNome: string;
  blocoId: string;
  blocoIdNorm: string;
  blocoNome: string;
  unidadeId: string;
  unidadeIdNorm: string;
  unidadeNome: string;
  areaId: string;
  areaNome: string;
  opcaoId: string;
  opcaoNome: string;
  valorCentavos: number;
  competencia: string;
  competenciaOriginal: string;
  status: FinanceiroStatusType;
  descricao: string;
  dataSolicitacao: any;
  dataEvento: any;
  dataCriacaoLancamento: any;
  createdAt: any;
  updatedAt: any;
  observacoes: string;
}

export function validateFinanceiroTransition(
  estadoAtual: FinanceiroStatusType,
  novoEstado: FinanceiroStatusType,
): { valido: true } | { valido: false; erro: string } {
  const transicoesPermitidas = transicoes[estadoAtual as FinanceiroStatus];

  if (!transicoesPermitidas) {
    return { valido: false, erro: `Estado atual desconhecido: "${estadoAtual}".` };
  }

  if (transicoesPermitidas.length === 0) {
    return { valido: false, erro: `O estado "${estadoAtual}" é terminal e não permite transições.` };
  }

  if (!transicoesPermitidas.includes(novoEstado as FinanceiroStatus)) {
    return {
      valido: false,
      erro: `Transição inválida: de "${estadoAtual}" para "${novoEstado}". Transições permitidas: [${transicoesPermitidas.join(", ")}].`,
    };
  }

  return { valido: true };
}

export function isFinanceiroTerminal(status: FinanceiroStatusType): boolean {
  return (statusTerminais as FinanceiroStatusType[]).includes(status);
}

export function isFinanceiroAtivo(status: FinanceiroStatusType): boolean {
  return (statusAtivos as FinanceiroStatusType[]).includes(status);
}

export function isFinanceiroPendente(status: FinanceiroStatusType): boolean {
  return (statusPendentes as FinanceiroStatusType[]).includes(status);
}

export function isFinanceiroQuitado(status: FinanceiroStatusType): boolean {
  return status === FinanceiroStatus.QUITADO;
}

export function canEnviarAdministradora(status: FinanceiroStatusType): boolean {
  return status === FinanceiroStatus.AGUARDANDO_ENVIO;
}

export function canCancelarLancamento(status: FinanceiroStatusType): boolean {
  return !isFinanceiroTerminal(status) && !isFinanceiroQuitado(status);
}

export function canEstornar(status: FinanceiroStatusType): boolean {
  return status === FinanceiroStatus.LANCADO_BOLETO || status === FinanceiroStatus.QUITADO;
}

export function canMarcarIsento(status: FinanceiroStatusType): boolean {
  return status === FinanceiroStatus.AGUARDANDO_ENVIO;
}

export function canProcessar(status: FinanceiroStatusType): boolean {
  return status === FinanceiroStatus.ENVIADO_ADMINISTRADORA;
}

export function canLancarBoleto(status: FinanceiroStatusType): boolean {
  return status === FinanceiroStatus.PROCESSANDO;
}

export function canQuitar(status: FinanceiroStatusType): boolean {
  return status === FinanceiroStatus.LANCADO_BOLETO;
}
