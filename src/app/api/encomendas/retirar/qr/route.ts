/**
 * FASE E.2.2 — POST /api/encomendas/retirar/qr
 *
 * Retirada por QR Code seguro.
 * O cliente envia apenas o qrToken opaco. O servidor descobre a encomenda
 * via hash, valida, e executa a retirada em transação atômica.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import {
  hashQRToken,
  isQRExpired,
  createWithdrawEvent,
} from "@/lib/encomendas/withdrawal";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();
  const correlationId = extractCorrelationId(req);
  let body: any = {};
  let decoded: any = null;
  let condominioId = "";

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente.", 401);

    decoded = await aauth.verifyIdToken(token);
    body = await req.json().catch(() => ({}));

    const qrTokenRaw = String(body?.qrToken || "").trim();

    if (!qrTokenRaw) return jsonError("qrToken é obrigatório.", 400);

    condominioId = String(body?.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    // Verificar permissão: apenas operadores
    const uid = String(decoded.uid);
    const isSuper = (decoded as any)?.super_admin === true || (decoded as any)?.superAdmin === true;
    let actorRole = "PORTEIRO";

    if (!isSuper) {
      const vincSnap = await db.collection("userCondominios").doc(uid)
        .collection("vinculos").doc(condominioId).get();
      if (!vincSnap.exists) return jsonError("Sem vínculo com o condomínio.", 403);
      const role = String(vincSnap.data()?.role || "").toUpperCase();
      if (!["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN", "PORTEIRO"].includes(role)) {
        return jsonError("Permissão insuficiente.", 403);
      }
      actorRole = role;
    } else {
      actorRole = "SUPER_ADMIN";
    }

    const qrHash = hashQRToken(qrTokenRaw);

    // Transação atômica de retirada por QR
    const result = await db.runTransaction(async (tx: any) => {
      // Buscar encomenda pelo QR hash (único dentro do condomínio)
      const encomendasSnap = await tx.get(
        db.collection("condominios").doc(condominioId)
          .collection("encomendas")
          .where("qrTokenHash", "==", qrHash)
          .limit(1)
      );

      if (encomendasSnap.empty) {
        throw Object.assign(new Error("QR não encontrado ou inválido."), { status: 404, code: "QR_NOT_FOUND" });
      }

      const encomendaRef = encomendasSnap.docs[0].ref;
      const data = encomendasSnap.docs[0].data() || {};

      // Validar status
      const status = String(data.status || "").toUpperCase();
      if (status !== "AGUARDANDO_RETIRADA" && status !== "AGUARDANDO" && status !== "PENDENTE") {
        throw Object.assign(new Error("Encomenda não está aguardando retirada."), { status: 409, code: "STATUS_INVALID" });
      }

      // Validar expiração
      const expiresAt = data.qrExpiresAt ? String(data.qrExpiresAt) : null;
      if (expiresAt && isQRExpired(expiresAt)) {
        throw Object.assign(new Error("QR expirado."), { status: 410, code: "QR_EXPIRED" });
      }

      // Validar uso único
      if (data.qrUsed === true) {
        throw Object.assign(new Error("QR já foi utilizado."), { status: 409, code: "QR_ALREADY_USED" });
      }

      // Executar retirada
      const now = new Date().toISOString();
      const actorNome = decoded.name || decoded.email || uid;

      tx.update(encomendaRef, {
        status: "RETIRADA",
        withdrawMethod: "QR_CODE",
        retiradaEm: FieldValue.serverTimestamp(),
        retiradoPorUid: uid,
        retiradoPorNome: actorNome,
        qrUsed: true,
        qrUsedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Registrar evento
      const eventRef = encomendaRef.collection("events").doc();
      tx.set(eventRef, createWithdrawEvent(
        "WITHDRAWN",
        uid,
        actorRole,
        actorNome,
        { method: "QR_CODE", encomendaId: encomendaRef.id, condominioId },
      ));

      return { encomendaId: encomendaRef.id };
    });

    logEncomendaEvent({
      event: "PACKAGE_WITHDRAW_QR_SUCCESS",
      timestamp: new Date().toISOString(),
      operation: "retirar/qr",
      result: "success",
      condominioId,
      encomendaId: (result as any).encomendaId,
      actorUid: uid,
      actorRole,
      method: "QR_CODE",
      correlationId,
    });

    return NextResponse.json({
      ok: true,
      encomendaId: (result as any).encomendaId,
      message: "Retirada confirmada via QR Code.",
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const code = err?.code || "UNKNOWN";
    logEncomendaEvent({
      event: code === "QR_ALREADY_USED" ? "PACKAGE_WITHDRAW_REPLAY_BLOCKED" : "PACKAGE_WITHDRAW_QR_SUCCESS",
      timestamp: new Date().toISOString(),
      operation: "retirar/qr",
      result: code === "QR_ALREADY_USED" ? "blocked" : "error",
      condominioId: body?.condominioId || null,
      actorUid: decoded?.uid || null,
      method: "QR_CODE",
      correlationId,
      errorCode: code,
      errorMessage: err?.message || "Erro inesperado.",
    });
    return jsonError(err?.message || "Erro inesperado.", status);
  }
}
