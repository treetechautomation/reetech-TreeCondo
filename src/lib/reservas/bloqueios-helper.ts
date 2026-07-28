/**
 * FASE 16.13 / R4 — HELPER CENTRAL DE BLOQUEIOS ADMINISTRATIVOS.
 * FASE 16.14 / R4.1 — + coordenação transacional via bloqueiosReservasControle.
 */

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

export type EscopoOperacao = "RESERVA_PRIVATIVA" | "USO_CAMPO";

export interface BlockCheckParams {
  db: Firestore;
  condominioId: string;
  uid: string;
  unidadeIdNorm: string;
  blocoIdNorm: string;
  areaId: string;
  escopoOperacao: EscopoOperacao;
  now?: Date;
}

export interface BlockCheckResult {
  blocked: boolean;
  blockId?: string;
  scope?: string;
  motivoPublico?: string;
}

const SCOPE_ORDER: Record<string, number> = {
  AREA_ESPECIFICA: 1, RESERVAS_PRIVATIVAS: 2, USO_CAMPO: 2, TODAS_AS_AREAS: 3,
};

export function unitCoordKey(blocoIdNorm: string, unidadeIdNorm: string): string {
  return `UNIT__${blocoIdNorm}__${unidadeIdNorm}`;
}

export function uidCoordKey(uid: string): string {
  return `UID__${uid}`;
}

function scopeMatches(b: any, escopoOperacao: EscopoOperacao, areaId: string): boolean {
  const escopo = String(b.escopo || "");
  if (escopo === "TODAS_AS_AREAS") return true;
  if (escopo === "RESERVAS_PRIVATIVAS" && escopoOperacao === "RESERVA_PRIVATIVA") return true;
  if (escopo === "USO_CAMPO" && escopoOperacao === "USO_CAMPO") return true;
  if (escopo === "AREA_ESPECIFICA" && String(b.areaId || "") === areaId) return true;
  return false;
}

function isVigente(b: any, now: Date): boolean {
  const inicio = b.inicioEm?.toDate?.() ?? new Date(0);
  const fim = b.fimEm?.toDate?.() ?? null;
  return inicio <= now && !(fim && fim <= now);
}

function pickBest(vigentes: any[]): Omit<BlockCheckResult, "blocked"> {
  vigentes.sort((a, b) => {
    const sa = SCOPE_ORDER[a.escopo] ?? 99;
    const sb = SCOPE_ORDER[b.escopo] ?? 99;
    if (sa !== sb) return sa - sb;
    return (b.criadoEm?.toDate?.()?.getTime?.() ?? 0) - (a.criadoEm?.toDate?.()?.getTime?.() ?? 0);
  });
  return {
    blockId: vigentes[0].id,
    scope: vigentes[0].escopo,
    motivoPublico: String(vigentes[0].motivoPublico || "Reservas temporariamente indisponíveis para esta unidade."),
  };
}

export async function checkReservaBlock(params: BlockCheckParams): Promise<BlockCheckResult> {
  const { db, condominioId, uid, unidadeIdNorm, blocoIdNorm, areaId, escopoOperacao, now } = params;
  const _now = now ?? new Date();
  const colRef = db.collection("condominios").doc(condominioId).collection("bloqueiosReservas");

  const [unitSnap, uidSnap] = await Promise.all([
    (unidadeIdNorm ? colRef.where("ativo", "==", true).where("blocoIdNorm", "==", blocoIdNorm).where("unidadeIdNorm", "==", unidadeIdNorm).get() : Promise.resolve({ docs: [] } as any)),
    (uid ? colRef.where("ativo", "==", true).where("uid", "==", uid).get() : Promise.resolve({ docs: [] } as any)),
  ]);

  const seen = new Set<string>();
  const vigentes: any[] = [];
  for (const doc of [...(unitSnap.docs || []), ...(uidSnap.docs || [])]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const b = doc.data();
    if (!isVigente(b, _now)) continue;
    if (!scopeMatches(b, escopoOperacao, areaId)) continue;
    vigentes.push({ id: doc.id, ...b });
  }

  if (vigentes.length === 0) return { blocked: false };
  return { blocked: true, ...pickBest(vigentes) };
}

/**
 * Versão transacional. Lê coordenadores via tx.get() para participar
 * do snapshot transacional e detectar conflitos com operações concorrentes.
 * Chamar DENTRO de runTransaction, ANTES de qualquer write.
 */
export async function checkReservaBlockTx(
  tx: any, db: Firestore,
  params: { condominioId: string; uid: string; unidadeIdNorm: string; blocoIdNorm: string; areaId: string; escopoOperacao: EscopoOperacao; now?: Date; },
): Promise<BlockCheckResult> {
  const { condominioId, uid, unidadeIdNorm, blocoIdNorm, areaId, escopoOperacao, now } = params;
  const _now = now ?? new Date();
  const controls = db.collection("condominios").doc(condominioId).collection("bloqueiosReservasControle");
  const colRef = db.collection("condominios").doc(condominioId).collection("bloqueiosReservas");

  // 1. Ler coordenadores via tx.get() — esta leitura DENTRO da transaction
  //    é o mecanismo de detecção de conflito: se admin tocar o mesmo coordinator,
  //    Firestore forçará retry desta transaction.
  if (uid) await tx.get(controls.doc(uidCoordKey(uid)));
  if (blocoIdNorm && unidadeIdNorm) await tx.get(controls.doc(unitCoordKey(blocoIdNorm, unidadeIdNorm)));

  // 2. Consultar bloqueios via tx.get() (participam do snapshot)
  const [unitSnap, uidSnap] = await Promise.all([
    (unidadeIdNorm && blocoIdNorm
      ? tx.get(colRef.where("ativo", "==", true).where("blocoIdNorm", "==", blocoIdNorm).where("unidadeIdNorm", "==", unidadeIdNorm))
      : Promise.resolve({ docs: [] } as any)),
    (uid ? tx.get(colRef.where("ativo", "==", true).where("uid", "==", uid)) : Promise.resolve({ docs: [] } as any)),
  ]);

  const seen = new Set<string>();
  const vigentes: any[] = [];
  for (const doc of [...(unitSnap.docs || []), ...(uidSnap.docs || [])]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const b = doc.data();
    if (!isVigente(b, _now)) continue;
    if (!scopeMatches(b, escopoOperacao, areaId)) continue;
    vigentes.push({ id: doc.id, ...b });
  }

  if (vigentes.length === 0) return { blocked: false };
  return { blocked: true, ...pickBest(vigentes) };
}

/**
 * Touch nos coordenadores administrativos. Chamado por APIs de criar/revogar
 * DENTRO de runTransaction para forçar retry de operações concorrentes.
 */
export function touchBlockCoordinators(
  tx: any,
  db: Firestore,
  condominioId: string,
  uid: string | null,
  blocoIdNorm: string | null,
  unidadeIdNorm: string | null,
): void {
  const controls = db.collection("condominios").doc(condominioId).collection("bloqueiosReservasControle");
  const ts = FieldValue.serverTimestamp();
  if (uid) tx.set(controls.doc(uidCoordKey(uid)), { version: FieldValue.increment(1), updatedAt: ts }, { merge: true });
  if (blocoIdNorm && unidadeIdNorm) tx.set(controls.doc(unitCoordKey(blocoIdNorm, unidadeIdNorm)), { version: FieldValue.increment(1), updatedAt: ts }, { merge: true });
}
