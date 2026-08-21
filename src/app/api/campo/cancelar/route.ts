/**
 * FASE 16.6 / R1 — POST /api/campo/cancelar
 *
 * Cancela registro de uso do Campo.
 * Owner ou operador autorizado. Porteiro NÃO pode cancelar.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { releasePendingGuestsForUsoCampoTx } from "@/lib/reservas/convidados-ledger-helper";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const OPERATOR_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function POST(request: Request) {
  try {
    let body;
    try { body = await request.json(); } catch { return jsonError("Body inválido.", 400); }

    const condominioId = String(body?.condominioId ?? "").trim();
    const registroId = String(body?.registroId ?? "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!registroId) return jsonError("registroId é obrigatório.", 400);

    const ctx = await apiGuard({
      request,
      condominioId,
    });

    const db = adminDb();
    const actorRole = ctx.isSuperAdmin ? "SUPER_ADMIN" : String(ctx.membroData?.role ?? "MORADOR").toUpperCase();
    const isOperator = ctx.isSuperAdmin || OPERATOR_ROLES.includes(actorRole as GuardRole);

    const registroRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(registroId);
    const registroSnap = await registroRef.get();

    if (!registroSnap.exists) {
      return jsonError("Registro não encontrado.", 404);
    }

    const registro = registroSnap.data()!;
    if (registro.status !== "ATIVO") {
      return NextResponse.json({ ok: true, already: true, status: registro.status });
    }

    if (!isOperator && ctx.uid !== registro.uid) {
      return jsonError("Você não tem permissão para cancelar este registro.", 403);
    }

    const unitKey = `${condominioId}::${(registro.blocoIdNorm ?? "").toLowerCase()}::${(registro.unidadeIdNorm ?? "").toLowerCase()}`;
    const competencia = (registro.dateStr as string).substring(0, 7);
    const ledgerRef = db.collection("condominios").doc(condominioId).collection("convidadosLedger").doc(`${unitKey}__${competencia}`);

    await db.runTransaction(async (tx: any) => {
      await releasePendingGuestsForUsoCampoTx(tx, db, ledgerRef, { condominioId, usoId: registroId });
      tx.update(registroRef, { status: "CANCELADO", canceladoEm: FieldValue.serverTimestamp(), canceladoPorUid: ctx.uid, updatedAt: FieldValue.serverTimestamp() });
    });

    return NextResponse.json({ ok: true, status: "CANCELADO" });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
