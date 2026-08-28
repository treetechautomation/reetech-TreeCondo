/**
 * FIX.ANUNCIOS.2A — Contrato temporal e de concorrência da publicação agendada.
 *
 * Contexto (ver GATE TREECONDO.R1.0.NEXT.2A): o formulário usa
 * `<input type="datetime-local">`, que produz uma string sem offset de
 * timezone (ex.: "2026-09-01T10:00"). Antes desta correção, essa string
 * era gravada crua em `publishAt` (nunca convertida para Firestore
 * Timestamp, ao contrário de `expiresAt`), e o cron de publicação
 * interpretava mal o valor resultante, produzindo sempre uma
 * comparação `Invalid Date > now` (sempre `false`), o que fazia
 * qualquer anúncio AGENDADO ser publicado imediatamente na primeira
 * execução do cron, independente da data escolhida.
 *
 * Decisão de contrato temporal (auditada no NEXT.2A antes de implementar):
 * o produto NÃO possui timezone configurável por condomínio hoje (busca
 * completa no código não encontrou nenhum campo `timezone`/`timeZone`
 * em `condominios` ou em qualquer config). Existe, porém, uma convenção
 * já estabelecida e documentada em todo o módulo de Reservas
 * (`src/lib/reservas/policy-engine`, `src/app/api/reservas/criar/route.ts`
 * — comentários "R1.0 — Etapa 0.1 (P1 #1)"): o horário civil de negócio
 * do produto é sempre `America/Sao_Paulo`, nunca o timezone do
 * host/processo (o servidor roda em UTC). Esta correção adota
 * exatamente a mesma convenção para `publishAt`, em vez de inventar um
 * sistema de timezone por tenant.
 *
 * Contrato:
 *   UI_LOCAL_DATETIME ("2026-09-01T10:00", sem offset)
 *     -> interpretado como horário civil em BUSINESS_TIMEZONE
 *     -> convertido para instante absoluto (UTC)
 *     -> persistido como Firestore Timestamp
 *
 * `expiresAt` NÃO é tocado por este módulo — mantém seu contrato atual
 * (fora de escopo deste gate; ver relatório NEXT.2A para uma nota sobre
 * uma inconsistência equivalente lá, deixada para gate futuro).
 */

export const BUSINESS_TIMEZONE = "America/Sao_Paulo";

/** Janela de tolerância antes de considerar uma reivindicação de notificação "travada" (processo morreu no meio). */
export const NOTIFICATION_CLAIM_STALE_MS = 5 * 60 * 1000; // 5 minutos

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Converte uma string "YYYY-MM-DDTHH:mm[:ss]" (sem offset, horário civil
 * em `timeZone`) para o instante absoluto (UTC) correspondente.
 *
 * Retorna `null` para qualquer entrada não parseável, calendário
 * impossível (ex. "2026-02-30"), ou tipo inesperado — nunca lança,
 * nunca retorna um `Date` inválido silenciosamente.
 */
export function parseZonedDateTimeLocal(
  input: unknown,
  timeZone: string = BUSINESS_TIMEZONE,
): Date | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const m = trimmed.match(DATETIME_LOCAL_RE);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  // Chute inicial: trata os componentes como se já fossem UTC.
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(guessUtcMs)) return null;

  // Rejeita datas de calendário inexistentes (ex.: 30 de fevereiro) —
  // Date.UTC normaliza silenciosamente ("rola" para o mês seguinte),
  // então confirmamos que os componentes voltam intactos.
  const check = new Date(guessUtcMs);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  // Descobre o offset real de `timeZone` nesse instante aproximado e
  // corrige o chute — algoritmo padrão de conversão wall-clock -> instante.
  const offsetMinutes = getTimeZoneOffsetMinutes(guessUtcMs, timeZone);
  let utcMs = guessUtcMs - offsetMinutes * 60_000;

  // Uma segunda iteração cobre o caso raro em que o offset muda entre o
  // chute inicial e o instante corrigido (borda de uma transição de DST,
  // caso o fuso de negócio algum dia volte a ter uma).
  const offsetMinutes2 = getTimeZoneOffsetMinutes(utcMs, timeZone);
  if (offsetMinutes2 !== offsetMinutes) {
    utcMs = guessUtcMs - offsetMinutes2 * 60_000;
  }

  const result = new Date(utcMs);
  return Number.isNaN(result.getTime()) ? null : result;
}

function getTimeZoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - utcMs) / 60_000);
}

/**
 * Um comunicado AGENDADO só é elegível para publicação automática se:
 * status === "AGENDADO" E publishAt é um instante válido E publishAt <= now.
 *
 * `publishAtDate` já deve ter sido resolvido (ex.: via `readDateFlexible`)
 * para `Date | null` antes de chamar esta função — ela não faz parsing.
 * Um `publishAt` ausente ou inválido NUNCA é tratado como "vencido":
 * retorna `{eligible:false, reason:"invalid_publish_at"}`, nunca publica.
 */
export type SchedulingEligibility =
  | { eligible: true }
  | { eligible: false; reason: "not_scheduled" | "invalid_publish_at" | "future" };

export function evaluateSchedulingEligibility(
  status: string | undefined,
  publishAtDate: Date | null,
  now: Date,
): SchedulingEligibility {
  if (String(status || "").toUpperCase() !== "AGENDADO") {
    return { eligible: false, reason: "not_scheduled" };
  }
  if (!publishAtDate || Number.isNaN(publishAtDate.getTime())) {
    return { eligible: false, reason: "invalid_publish_at" };
  }
  if (publishAtDate.getTime() > now.getTime()) {
    return { eligible: false, reason: "future" };
  }
  return { eligible: true };
}

/**
 * Decide se a execução atual pode reivindicar o direito de enviar a
 * notificação de um comunicado (evita notificação duplicada sob
 * execuções concorrentes — ver GATE NEXT.2A §17/§20).
 *
 * `notificationStatus` é `null`/`undefined` (nunca tentado), `"PENDING"`
 * (reivindicado, envio em andamento ou processo morto no meio),
 * `"SENT"` (concluído) ou `"FAILED"` (tentativa anterior falhou,
 * elegível para nova tentativa).
 *
 * Uma reivindicação `"PENDING"` mais antiga que `staleMs` é considerada
 * travada (processo morreu entre reivindicar e enviar) e pode ser
 * reivindicada novamente.
 */
export function canClaimNotification(
  notificationStatus: string | null | undefined,
  notificationClaimedAt: Date | null,
  now: Date,
  staleMs: number = NOTIFICATION_CLAIM_STALE_MS,
): boolean {
  if (!notificationStatus || notificationStatus === "FAILED") return true;
  if (notificationStatus === "SENT") return false;
  if (notificationStatus === "PENDING") {
    if (!notificationClaimedAt) return true; // estado inconsistente — trata como reivindicável
    return now.getTime() - notificationClaimedAt.getTime() > staleMs;
  }
  return false;
}
