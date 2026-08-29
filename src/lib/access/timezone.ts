/**
 * ACCESS.3 — TIMEZONE POR CONDOMÍNIO + JANELA DE VALIDADE DA VISITA.
 *
 * Correção 1.3 do arquiteto sobre ACCESS.2: NÃO introduzir um novo
 * hardcode global "America/Sao_Paulo" específico de Acesso. O domínio
 * deve preferir explicitamente `condominio.timezone` quando presente,
 * com fallback para "America/Sao_Paulo" apenas para compatibilidade dos
 * tenants existentes (nenhum condomínio possui esse campo hoje — busca
 * confirmada no ACCESS.2/scheduling.ts). Este módulo NÃO cria o campo
 * no Firestore nem migra condomínios — apenas lê se existir.
 *
 * Reaproveita `parseZonedDateTimeLocal` de `@/lib/anuncios/scheduling`
 * em vez de reimplementar a matemática de conversão fuso→instante: é a
 * mesma operação (string civil sem offset -> instante absoluto),
 * já testada (102 testes) e já corrigida para bordas de DST. Duplicar
 * essa lógica arriscaria duas implementações divergindo silenciosamente
 * entre os dois módulos. `scheduling.ts` NÃO é modificado por este
 * gate (proibido pela correção 1.3).
 */

import { parseZonedDateTimeLocal, BUSINESS_TIMEZONE } from "@/lib/anuncios/scheduling";

/** Fallback de compatibilidade — usado somente quando o condomínio não define `timezone` explicitamente. */
export const DEFAULT_ACCESS_TIMEZONE = BUSINESS_TIMEZONE;

/**
 * Resolve o timezone efetivo de um condomínio. Aceita o shape mínimo
 * necessário (não o documento inteiro) para manter a função testável
 * sem depender do tipo completo de Condominio.
 */
export function getCondominioTimezone(condominio: { timezone?: string | null } | null | undefined): string {
  const tz = condominio?.timezone;
  return typeof tz === "string" && tz.trim() ? tz.trim() : DEFAULT_ACCESS_TIMEZONE;
}

export interface VisitDateWindowInput {
  /** "YYYY-MM-DD" — obrigatório. */
  visitDate: string;
  /** Opcional — puramente informativo, NUNCA usado para estender/reduzir a janela de nova entrada (ACCESS.2 invariante #1). */
  expectedEntryAt?: Date | null;
  timezone: string;
}

export interface VisitDateWindowResult {
  newEntryValidFrom: Date;
  newEntryValidUntil: Date;
}

const VISIT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Calcula a janela de validade para NOVA ENTRADA a partir da data civil
 * da visita, no timezone do condomínio.
 *
 * Regra MVP (ACCESS.2 §30, confirmada): sem horário definido, a janela
 * é o dia civil completo (00:00:00 até 23:59:59) no timezone do
 * condomínio. `expectedEntryAt`, se fornecido, é armazenado no registro
 * mas NÃO altera esta janela — ele é informativo para a portaria
 * ("o morador disse que chega por volta de tal hora"), nunca uma regra
 * de elegibilidade. Isso segue exatamente a decisão congelada no
 * ACCESS.2 (seção "Time model" / ENTRY_VALID_FROM), sem inconsistência
 * a documentar.
 *
 * Retorna `null` se `visitDate` não for uma data civil válida — nunca
 * lança, nunca retorna uma janela inconsistente silenciosamente.
 */
export function computeVisitDateWindow(input: VisitDateWindowInput): VisitDateWindowResult | null {
  if (!VISIT_DATE_RE.test(input.visitDate)) return null;

  const newEntryValidFrom = parseZonedDateTimeLocal(`${input.visitDate}T00:00:00`, input.timezone);
  const newEntryValidUntil = parseZonedDateTimeLocal(`${input.visitDate}T23:59:59`, input.timezone);
  if (!newEntryValidFrom || !newEntryValidUntil) return null;

  return { newEntryValidFrom, newEntryValidUntil };
}
