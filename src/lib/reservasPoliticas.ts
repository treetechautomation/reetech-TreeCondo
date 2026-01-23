import { doc, getDoc, type Firestore } from "firebase/firestore";

export type ReservasPoliticas = {
  bloquearDomingo: boolean;
  autoAprovarAposHoras: number; // >= 24 => auto aprova
  exigirAprovacaoQuandoMenosQueHoras: number; // < 24 => exige aprovação
  cancelamentoMinHoras: number; // 48h
};

const DEFAULTS: ReservasPoliticas = {
  bloquearDomingo: true,
  autoAprovarAposHoras: 24,
  exigirAprovacaoQuandoMenosQueHoras: 24,
  cancelamentoMinHoras: 48,
};

export function isSunday(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0, 0));
  return dt.getUTCDay() === 0; // 0 = domingo
}

function hoursFromNowTo(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)); // meio-dia UTC
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return diffMs / (1000 * 60 * 60);
}

export async function getPoliticasReservas(
  firestore: Firestore,
  condominioId: string
): Promise<ReservasPoliticas> {
  try {
    const ref = doc(firestore, "condominios", condominioId, "config", "reservas");
    const snap = await getDoc(ref);
    if (!snap.exists()) return DEFAULTS;

    const d = snap.data() as any;

    return {
      bloquearDomingo: Boolean(d.bloquearDomingo ?? DEFAULTS.bloquearDomingo),
      autoAprovarAposHoras: Number(d.autoAprovarAposHoras ?? DEFAULTS.autoAprovarAposHoras),
      exigirAprovacaoQuandoMenosQueHoras: Number(
        d.exigirAprovacaoQuandoMenosQueHoras ?? DEFAULTS.exigirAprovacaoQuandoMenosQueHoras
      ),
      cancelamentoMinHoras: Number(d.cancelamentoMinHoras ?? DEFAULTS.cancelamentoMinHoras),
    };
  } catch {
    return DEFAULTS;
  }
}

// Retorna "APROVADA" quando não precisa aprovação
export function getStatusForNewReserva(dateStr: string, politicas: ReservasPoliticas) {
  const hrs = hoursFromNowTo(dateStr);
  if (hrs >= politicas.autoAprovarAposHoras) return "APROVADA";
  return "PENDENTE";
}

export function requiresApproval(dateStr: string, politicas: ReservasPoliticas) {
  const hrs = hoursFromNowTo(dateStr);
  return hrs < politicas.exigirAprovacaoQuandoMenosQueHoras;
}

// Útil para regras de cancelamento no futuro
export function canCancelReserva(dateStr: string, politicas: ReservasPoliticas) {
  const hrs = hoursFromNowTo(dateStr);
  return hrs >= politicas.cancelamentoMinHoras;
}
