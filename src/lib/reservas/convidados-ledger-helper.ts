/**
 * FASE 16.18 / R6 — CONVIDADOS LEDGER HELPER.
 *
 * Gerencia saldo mensal de convidados para uso comum.
 * Todas as mutações são transacionais (tx.get no ledger).
 */

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export function buildUnitKey(condominioId: string, blocoIdNorm: string, unidadeIdNorm: string): string {
  return `${condominioId}::${blocoIdNorm}::${unidadeIdNorm}`;
}

export function ledgerId(unitKey: string, competencia: string): string {
  return `${unitKey}__${competencia}`;
}

export function competenciaFromDate(dateStr: string): string {
  return dateStr.substring(0, 7); // YYYY-MM
}

export function entryId(origemTipo: string, origemId: string, convidadoId: string): string {
  return `${origemTipo}__${origemId}__${convidadoId}`;
}

export function isUsoCampoEncerrado(u: { dateStr: string; fimMin: number; status?: string }, now: Date): boolean {
  if (u.status === "CANCELADO") return true;
  const today = todaySaoPauloISO(now);
  if (u.dateStr < today) return true;
  if (u.dateStr === today) {
    const cm = now.getHours() * 60 + now.getMinutes();
    return cm >= u.fimMin;
  }
  return false;
}

function todaySaoPauloISO(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function getOrCreateLedgerTx(tx: any, db: Firestore, params: {
  condominioId: string; unitKey: string; competencia: string;
  blocoIdNorm: string; unidadeIdNorm: string; saldoTotal: number;
}): Promise<{ ref: any; data: any; created: boolean }> {
  const ref = db.collection("condominios").doc(params.condominioId)
    .collection("convidadosLedger").doc(ledgerId(params.unitKey, params.competencia));
  const snap = await tx.get(ref);
  if (snap.exists) return { ref, data: snap.data()!, created: false };

  const ts = FieldValue.serverTimestamp();
  const data: any = {
    condominioId: params.condominioId, blocoIdNorm: params.blocoIdNorm, unidadeIdNorm: params.unidadeIdNorm,
    unitKey: params.unitKey, competencia: params.competencia,
    saldoTotal: params.saldoTotal, saldoConsumido: 0, saldoReservado: 0, saldoDevolvido: 0,
    version: 1, createdAt: ts, updatedAt: ts,
  };
  tx.set(ref, data);
  return { ref, data, created: true };
}

export function disponivel(data: any): number {
  return (data.saldoTotal ?? 0) - (data.saldoConsumido ?? 0) - (data.saldoReservado ?? 0);
}

/**
 * Reconcilia no-shows: libera convidados RESERVADOS de usosCampo encerrados.
 * Atualiza ledger atomicamente (N convidados → 1 update).
 */
export async function releasePendingGuestsForUsoCampoTx(
  tx: any, db: Firestore, ledgerRef: any,
  params: { condominioId: string; usoId: string; now?: Date },
): Promise<number> {
  const now = params.now ?? new Date();
  const usoRef = db.collection("condominios").doc(params.condominioId)
    .collection("usoCampo").doc(params.usoId);
  const usoSnap = await tx.get(usoRef);
  if (!usoSnap.exists) return 0;
  const uso = usoSnap.data()!;
  if (!isUsoCampoEncerrado({ dateStr: uso.dateStr, fimMin: uso.fimMin, status: uso.status }, now)) return 0;

  const guestsSnap = await tx.get(
    db.collection("condominios").doc(params.condominioId)
      .collection("usoCampo").doc(params.usoId)
      .collection("convidados").where("status", "==", "RESERVADO")
  );

  const ledgerSnap = await tx.get(ledgerRef);
  if (!ledgerSnap.exists) return 0;
  const ledger = ledgerSnap.data()!;

  let count = 0;
  for (const gDoc of guestsSnap.docs) {
    const g = gDoc.data();
    if (g.status !== "RESERVADO") continue;

    tx.update(gDoc.ref, { status: "LIBERADO", liberadoEm: FieldValue.serverTimestamp() });

    const eRef = db.collection("condominios").doc(params.condominioId)
      .collection("convidadosLedgerEntries").doc(entryId("USO_CAMPO", params.usoId, gDoc.id));
    tx.set(eRef, { status: "LIBERADO", updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    count++;
  }

  if (count > 0) {
    tx.update(ledgerRef, {
      saldoReservado: (ledger.saldoReservado ?? 0) - count,
      saldoDevolvido: (ledger.saldoDevolvido ?? 0) + count,
      version: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return count;
}
