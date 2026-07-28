/**
 * Mapper puro de compatibilidade para leitura de documentos da coleção
 * condominios/{condominioId}/financeiro/{lancamentoId}.
 *
 * Normaliza tanto o schema legado (pré-F1) quanto o novo schema (F1/F2)
 * para um formato unificado de leitura. Não altera o Firestore.
 *
 * CLASSIFICAÇÃO: módulo de fundação — sem dependências de React, Firebase ou Next.
 */

import { FinanceiroStatus } from "./financeiroStatus";
import type { FinanceiroStatusType } from "./financeiroStatus";

export interface LancamentoLeitura {
  id: string;
  tipo: string;
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

function toSafeIntCentavos(raw: any, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return fallback;
  return n;
}

function toSafeString(v: any, fallback = ""): string {
  return String(v ?? fallback);
}

function dataFromRaw(raw: any, fallbackKey?: string, rawDoc?: any): any {
  if (raw != null) return raw;
  if (fallbackKey && rawDoc != null && rawDoc[fallbackKey] != null) return rawDoc[fallbackKey];
  return null;
}

function mapLegacyStatus(rawStatus: string): FinanceiroStatusType {
  const s = rawStatus.toLowerCase();
  if (s === "pago" || s === "quitado") return FinanceiroStatus.QUITADO;
  if (s === "cancelado") return FinanceiroStatus.CANCELADO;
  return FinanceiroStatus.AGUARDANDO_ENVIO;
}

function buildUnidadeNome(blocoNome: string, unidadeId: string): string {
  return [blocoNome, unidadeId].filter(Boolean).join(" - ") || "";
}

/**
 * Normaliza um documento raw do Firestore (legado ou novo) para LancamentoLeitura.
 */
export function normalizeLancamento(raw: Record<string, any>, docId: string): LancamentoLeitura {
  const isLegacy = raw.valor != null && raw.valorCentavos == null;

  const valorCentavos = isLegacy
    ? toSafeIntCentavos(Math.round(Number(raw.valor || 0) * 100), 0)
    : toSafeIntCentavos(raw.valorCentavos, 0);

  const status = raw.status != null
    ? (
        Object.values(FinanceiroStatus).includes(raw.status as FinanceiroStatus)
          ? raw.status as FinanceiroStatusType
          : mapLegacyStatus(String(raw.status))
      )
    : FinanceiroStatus.AGUARDANDO_ENVIO;

  const blocoNomeVal = toSafeString(raw.blocoNome || raw.bloco || raw.blocoId);
  const unidadeIdVal = toSafeString(raw.unidadeId || raw.unidadeIdNorm || raw.apto);

  return {
    id: docId,
    tipo: toSafeString(raw.tipo, "TAXA_RESERVA"),
    reservaId: toSafeString(raw.reservaId),
    numeroReserva: toSafeString(raw.numeroReserva),
    moradorUid: toSafeString(raw.moradorUid || raw.moradorId),
    moradorNome: toSafeString(raw.moradorNome || raw.morador),
    blocoId: toSafeString(raw.blocoId || raw.bloco),
    blocoIdNorm: toSafeString(raw.blocoIdNorm),
    blocoNome: blocoNomeVal,
    unidadeId: unidadeIdVal,
    unidadeIdNorm: toSafeString(raw.unidadeIdNorm || raw.unidadeId),
    unidadeNome: toSafeString(raw.unidadeNome, buildUnidadeNome(blocoNomeVal, unidadeIdVal)),
    areaId: toSafeString(raw.areaId),
    areaNome: toSafeString(raw.areaNome),
    opcaoId: toSafeString(raw.opcaoId),
    opcaoNome: toSafeString(raw.opcaoNome),
    valorCentavos,
    competencia: toSafeString(raw.competencia),
    competenciaOriginal: toSafeString(raw.competenciaOriginal, raw.competencia),
    status,
    descricao: toSafeString(raw.descricao),
    dataSolicitacao: dataFromRaw(raw.dataSolicitacao, "createdAt", raw),
    dataEvento: dataFromRaw(raw.dataEvento, "vencimento", raw),
    dataCriacaoLancamento: dataFromRaw(raw.dataCriacaoLancamento, "createdAt", raw),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    observacoes: toSafeString(raw.observacoes),
  };
}

export function agruparPorBlocoUnidade(lancamentos: LancamentoLeitura[]): Map<string, LancamentoLeitura[]> {
  const map = new Map<string, LancamentoLeitura[]>();
  for (const l of lancamentos) {
    const key = `${l.blocoIdNorm || "_"}:${l.unidadeIdNorm || "_"}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(l);
  }
  return map;
}

export function chaveParaRotuloBlocoUnidade(lancamentos: LancamentoLeitura[]): string {
  if (lancamentos.length === 0) return "";
  const l = lancamentos[0];
  return [l.blocoNome, l.unidadeId].filter(Boolean).join(" — ") || l.unidadeNome || "";
}
