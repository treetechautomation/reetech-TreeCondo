/**
 * FASE D.11.9.6 — GUEST LIST HELPER (SERVER-SIDE).
 *
 * Fonte ÚNICA da verdade para convidados:
 *   condominios/{id}/reservas/{reservaId}/convidados
 *
 * NUNCA confiar em body.guestCount, reservation.guestCount, ou frontendGuestCount.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { PolicyDocument } from "./types";

export type GuestListStatus =
  | "NAO_EXIGIDA"
  | "AGUARDANDO_LISTA"
  | "ENVIADA"
  | "BLOQUEADA"
  | "ATRASADA";

export type GuestListFacts = {
  count: number;
  isEmpty: boolean;
  limit: number | null;
  exceeded: boolean;
  required: boolean;
  submitDeadlineAt: Date | null;
  deadlineExpired: boolean;
  listStatus: GuestListStatus;
  /** Indica erro de leitura (UNKNOWN/ERROR). */
  readError: boolean;
  errorReason?: string;
};

export async function getGuestListFacts(params: {
  db: Firestore;
  condominioId: string;
  reservaId: string;
  policy: PolicyDocument;
  now?: Date;
}): Promise<GuestListFacts> {
  const { db, condominioId, reservaId, policy, now = new Date() } = params;
  const guestList = policy.capacity.guestList;

  if (!guestList.required) {
    return {
      count: 0, isEmpty: true, limit: null, exceeded: false,
      required: false, submitDeadlineAt: null, deadlineExpired: false,
      listStatus: "NAO_EXIGIDA", readError: false,
    };
  }

  let count = 0;
  let readError = false;
  let errorReason: string | undefined;

  try {
    const snap = await db
      .collection("condominios")
      .doc(condominioId)
      .collection("reservas")
      .doc(reservaId)
      .collection("convidados")
      .get();
    count = snap.size;
  } catch (err: any) {
    readError = true;
    errorReason = String(err?.message || err);
  }

  const limit = guestList.maxGuests ?? policy.capacity.maxPeople;
  const exceeded = limit != null && count > limit;
  const submitDeadlineHours = guestList.submitDeadlineHours || 0;

  // Prazo calculado em America/Sao_Paulo:
  // O deadline é N horas antes do evento (data da reserva).
  // Como não temos a data da reserva neste helper, o prazo é recebido do chamador.
  // Para compatibilidade: deadlineExpired é calculado externamente.
  const submitDeadlineAt = submitDeadlineHours > 0
    ? new Date(now.getTime() + submitDeadlineHours * 3600_000)
    : null;

  let listStatus: GuestListStatus = "AGUARDANDO_LISTA";
  if (readError) {
    listStatus = "AGUARDANDO_LISTA"; // não pode afirmar que está enviada
  } else if (count > 0) {
    listStatus = "ENVIADA";
  } else if (guestList.lockAfterDeadline && submitDeadlineHours > 0) {
    // O deadlineExpired deve ser calculado usando a data do evento.
    // Por ora, marcamos como AGUARDANDO_LISTA.
  }

  return {
    count,
    isEmpty: count === 0,
    limit,
    exceeded,
    required: true,
    submitDeadlineAt,
    deadlineExpired: false, // calculado externamente com a data da reserva
    listStatus,
    readError,
    errorReason,
  };
}
