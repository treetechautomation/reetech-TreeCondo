import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { hashQRToken, isQRExpired, createWithdrawEvent } from "@/lib/encomendas/withdrawal";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function POST(req: Request) {
  const db = adminDb();
  const correlationId = extractCorrelationId(req);
  let body: any = {};
  let condominioId = "";

  try {
    body = await req.json().catch(() => ({}));

    const qrTokenRaw = String(body?.qrToken || "").trim();
    if (!qrTokenRaw) return jsonError("qrToken é obrigatório.", 400);

    condominioId = String(body?.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "PORTEIRO"],
    });

    const uid = ctx.uid;
    const actorRole = ctx.isSuperAdmin ? "SUPER_ADMIN" : (ctx.role || "PORTEIRO");

    const qrHash = hashQRToken(qrTokenRaw);

    const result = await db.runTransaction(async (tx: any) => {
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

      const status = String(data.status || "").toUpperCase();
      if (status !== "AGUARDANDO_RETIRADA" && status !== "AGUARDANDO" && status !== "PENDENTE") {
        throw Object.assign(new Error("Encomenda não está aguardando retirada."), { status: 409, code: "STATUS_INVALID" });
      }

      const expiresAt = data.qrExpiresAt ? String(data.qrExpiresAt) : null;
      if (expiresAt && isQRExpired(expiresAt)) {
        throw Object.assign(new Error("QR expirado."), { status: 410, code: "QR_EXPIRED" });
      }

      if (data.qrUsed === true) {
        throw Object.assign(new Error("QR já foi utilizado."), { status: 409, code: "QR_ALREADY_USED" });
      }

      const now = new Date().toISOString();
      const actorNome = ctx.decodedToken?.name || ctx.decodedToken?.email || uid;

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
    if (err instanceof Response) return err;
    const status = err?.status || 500;
    const code = err?.code || "UNKNOWN";
    logEncomendaEvent({
      event: code === "QR_ALREADY_USED" ? "PACKAGE_WITHDRAW_REPLAY_BLOCKED" : "PACKAGE_WITHDRAW_QR_SUCCESS",
      timestamp: new Date().toISOString(),
      operation: "retirar/qr",
      result: code === "QR_ALREADY_USED" ? "blocked" : "error",
      condominioId: body?.condominioId || null,
      actorUid: null,
      method: "QR_CODE",
      correlationId,
      errorCode: code,
      errorMessage: err?.message || "Erro inesperado.",
    });
    return jsonError(err?.message || "Erro inesperado.", status);
  }
}
