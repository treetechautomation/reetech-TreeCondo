/**
 * FASE 16.6 / R1 — POST /api/campo/cancelar
 *
 * Cancela registro de uso do Campo.
 * Owner ou operador autorizado. Porteiro NÃO pode cancelar.
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { releasePendingGuestsForUsoCampoTx } from "@/lib/reservas/convidados-ledger-helper";

const OPERATOR_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "ADMIN_CONDOMINIO", "SINDICO"]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch {
    return jsonError("Não autorizado.", 401);
  }

  const uid = String(decoded.uid);
  const isSuper = !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin;

  let body;
  try { body = await request.json(); } catch { return jsonError("Body inválido.", 400); }

  const condominioId = String(body?.condominioId ?? "").trim();
  const registroId = String(body?.registroId ?? "").trim();

  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
  if (!registroId) return jsonError("registroId é obrigatório.", 400);

  const db = adminDb();
  const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
  const membroSnap = await membroRef.get();

  let actorRole = "MORADOR";
  let isOperator = isSuper;
  if (membroSnap.exists) {
    const m = membroSnap.data()!;
    const status = String(m.status ?? "").trim().toUpperCase();
    if (status !== "ATIVO" && !isSuper) return jsonError("Acesso restrito.", 403);
    actorRole = String(m.role ?? "MORADOR").toUpperCase();
    if (OPERATOR_ROLES.has(actorRole)) isOperator = true;
  } else if (!isSuper) {
    return jsonError("Membro não encontrado no condomínio.", 403);
  }

  const registroRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(registroId);
  const registroSnap = await registroRef.get();

  if (!registroSnap.exists) {
    return jsonError("Registro não encontrado.", 404);
  }

  const registro = registroSnap.data()!;
  if (registro.status !== "ATIVO") {
    return jsonOk({ ok: true, already: true, status: registro.status }, 200);
  }

  // Portaria (PORTEIRO, SEGURANCA) não pode cancelar
  if (!isOperator && uid !== registro.uid) {
    return jsonError("Você não tem permissão para cancelar este registro.", 403);
  }

  // R6: transactional guest release
  const unitKey = `${condominioId}::${(registro.blocoIdNorm ?? "").toLowerCase()}::${(registro.unidadeIdNorm ?? "").toLowerCase()}`;
  const competencia = (registro.dateStr as string).substring(0, 7);
  const ledgerRef = db.collection("condominios").doc(condominioId).collection("convidadosLedger").doc(`${unitKey}__${competencia}`);

  await db.runTransaction(async (tx: any) => {
    await releasePendingGuestsForUsoCampoTx(tx, db, ledgerRef, { condominioId, usoId: registroId });
    tx.update(registroRef, { status: "CANCELADO", canceladoEm: FieldValue.serverTimestamp(), canceladoPorUid: uid, updatedAt: FieldValue.serverTimestamp() });
  });

  return jsonOk({ ok: true, status: "CANCELADO" }, 200);
}
