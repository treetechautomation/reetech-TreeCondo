import { Timestamp } from "firebase/firestore";

/**
 * Política TreeCondo - Reservas
 * - Não permite reservas aos domingos
 * - Dentro de 24h: precisa aprovação (status PENDENTE_APROVACAO)
 * - A partir de 24h: não precisa aprovação (status APROVADA)
 * - Cancelamento: só até 48h antes do início
 */

export function parseLocalDateStr(dateStr: string) {
  // dateStr = "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0); // meia-noite LOCAL
}

export function isSunday(dateStr: string) {
  const dt = parseLocalDateStr(dateStr);
  return dt.getDay() === 0; // 0 = domingo
}

export function hoursUntilLocalDayStart(dateStr: string, now = new Date()) {
  const start = parseLocalDateStr(dateStr).getTime();
  const diffMs = start - now.getTime();
  return diffMs / (1000 * 60 * 60);
}

export function requiresApproval(dateStr: string, now = new Date()) {
  // regra: dentro de 24h precisa aprovação
  const hrs = hoursUntilLocalDayStart(dateStr, now);
  return hrs < 24;
}

export function getStatusForNewReserva(dateStr: string, now = new Date()) {
  return requiresApproval(dateStr, now) ? "PENDENTE_APROVACACAO" : "APROVADA";
}

/**
 * Cancelamento: somente até 48h antes do início (data da reserva).
 */
export function canCancelReserva(reservaData: Timestamp | Date, now = new Date(), hours = 48) {
  const dt = reservaData instanceof Date ? reservaData : reservaData.toDate();
  const diffMs = dt.getTime() - now.getTime();
  return diffMs >= hours * 60 * 60 * 1000;
}
