/**
 * FASE D.11.9 — RESERVAS QUOTAS HELPER (INFRAESTRUTURA TRANSACIONAL).
 *
 * Gerencia o documento de cota mensal por unidade.
 * NÃO ativado como decisor oficial — CREATE/CANCEL permanecem em SHADOW.
 * Preparado para integração transacional na D.12.
 *
 * Path: condominios/{id}/reservasQuotas/{quotaId}
 * quotaId = unitKey__YYYY-MM  (ex: "cond1::rosas::101__2026-07")
 */

import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { UnitKey } from "./types";

/** Identificador determinístico da quota mensal. */
export function quotaId(unitKey: UnitKey, yearMonth: string): string {
  // Garantir formato seguro para path Firestore (sem //, sem espaços)
  const safe = unitKey.replace(/\/\//g, "::").replace(/\s/g, "_");
  return `${safe}__${yearMonth}`;
}

export interface QuotaDoc {
  unitKey: UnitKey;
  competencia: string;
  reservationCount: number;
  activeFutureCount: number;
  /** IDs das reservas contadas (idempotência). */
  reservationIds: Record<string, boolean>;
  updatedAt: any;
}

function quotaRef(db: Firestore, condominioId: string, quotaId: string) {
  return db.collection("condominios").doc(condominioId)
    .collection("reservasQuotas").doc(quotaId);
}

/** Lê a quota atual (fora de transação — snapshot). */
export async function readQuota(
  db: Firestore,
  condominioId: string,
  unitKey: UnitKey,
  yearMonth: string,
): Promise<QuotaDoc> {
  const snap = await quotaRef(db, condominioId, quotaId(unitKey, yearMonth)).get();
  if (!snap.exists) {
    return {
      unitKey, competencia: yearMonth,
      reservationCount: 0, activeFutureCount: 0,
      reservationIds: {}, updatedAt: null,
    };
  }
  const d = snap.data()!;
  return {
    unitKey: String(d.unitKey ?? unitKey),
    competencia: String(d.competencia ?? yearMonth),
    reservationCount: Number(d.reservationCount ?? 0),
    activeFutureCount: Number(d.activeFutureCount ?? 0),
    reservationIds: (d.reservationIds as Record<string, boolean>) ?? {},
    updatedAt: d.updatedAt ?? null,
  };
}

/**
 * Lê a quota atual DENTRO de uma transação (antes de qualquer write).
 */
export async function readQuotaTx(
  tx: Transaction,
  db: Firestore,
  condominioId: string,
  unitKey: UnitKey,
  yearMonth: string,
): Promise<QuotaDoc> {
  const snap = await tx.get(quotaRef(db, condominioId, quotaId(unitKey, yearMonth)));
  if (!snap.exists) {
    return { unitKey, competencia: yearMonth, reservationCount: 0, activeFutureCount: 0, reservationIds: {}, updatedAt: null };
  }
  const d = snap.data()!;
  return {
    unitKey: String(d.unitKey ?? unitKey),
    competencia: String(d.competencia ?? yearMonth),
    reservationCount: Number(d.reservationCount ?? 0),
    activeFutureCount: Number(d.activeFutureCount ?? 0),
    reservationIds: (d.reservationIds as Record<string, boolean>) ?? {},
    updatedAt: d.updatedAt ?? null,
  };
}

/**
 * Incrementa a quota — write-only. A leitura deve ter sido feita antes
 * com readQuotaTx. Idempotente por reservaId.
 */
export function incrementQuotaTx(
  tx: Transaction,
  db: Firestore,
  condominioId: string,
  unitKey: UnitKey,
  yearMonth: string,
  reservaId: string,
  current: QuotaDoc,
): void {
  if (current.reservationIds[reservaId]) return;

  tx.set(quotaRef(db, condominioId, quotaId(unitKey, yearMonth)), {
    unitKey,
    competencia: yearMonth,
    reservationCount: current.reservationCount + 1,
    activeFutureCount: current.activeFutureCount + 1,
    reservationIds: { ...current.reservationIds, [reservaId]: true },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * Decrementa a quota — write-only. A leitura deve ter sido feita antes.
 * Idempotente.
 */
export function decrementQuotaTx(
  tx: Transaction,
  db: Firestore,
  condominioId: string,
  unitKey: UnitKey,
  yearMonth: string,
  reservaId: string,
  current: QuotaDoc,
): void {
  if (!current.reservationIds[reservaId]) return;

  const newIds = { ...current.reservationIds };
  delete newIds[reservaId];

  tx.set(quotaRef(db, condominioId, quotaId(unitKey, yearMonth)), {
    unitKey,
    competencia: yearMonth,
    reservationCount: Math.max(0, current.reservationCount - 1),
    activeFutureCount: Math.max(0, current.activeFutureCount - 1),
    reservationIds: newIds,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
