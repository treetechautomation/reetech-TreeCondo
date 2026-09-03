import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { hashQRToken, createWithdrawEvent } from "@/lib/encomendas/withdrawal";
import { evaluatePackageQrAttempt } from "@/lib/encomendas/packageQrPolicy";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

/**
 * ENCOMENDAS.2E — mapeamento seguro de outcome -> resposta HTTP + evento
 * de auditoria. Nenhuma mensagem revela o hash armazenado ou o token
 * esperado.
 */
function qrOutcomeToResponse(code: string): { message: string; status: number; errorCode: string } {
  switch (code) {
    case "QR_EXPIRED":
      return { message: "QR expirado.", status: 410, errorCode: "QR_EXPIRED" };
    case "QR_ALREADY_USED":
      return { message: "QR já foi utilizado.", status: 409, errorCode: "QR_ALREADY_USED" };
    case "PACKAGE_ALREADY_WITHDRAWN":
      return { message: "Essa encomenda já foi retirada.", status: 409, errorCode: "PACKAGE_ALREADY_WITHDRAWN" };
    case "STATUS_INVALID":
      return { message: "Encomenda não está aguardando retirada.", status: 409, errorCode: "STATUS_INVALID" };
    case "QR_NOT_FOUND":
      return { message: "QR não encontrado ou inválido.", status: 404, errorCode: "QR_NOT_FOUND" };
    default:
      return { message: "Não foi possível confirmar a retirada.", status: 400, errorCode: "UNKNOWN" };
  }
}

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

      // Hash sem match nenhum: falha fechada por construção — a query já
      // não localiza nenhum documento (nenhum "QR quase certo" existe).
      if (encomendasSnap.empty) {
        return { ok: false as const, code: "QR_NOT_FOUND" };
      }

      const encomendaRef = encomendasSnap.docs[0].ref;
      const data = encomendasSnap.docs[0].data() || {};

      const outcome = evaluatePackageQrAttempt(data, new Date());
      if (outcome.code !== "SUCCESS") {
        return { ok: false as const, code: outcome.code };
      }

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

      return { ok: true as const, encomendaId: encomendaRef.id as string };
    });

    if (!result.ok) {
      const { message, status, errorCode } = qrOutcomeToResponse(result.code);
      logEncomendaEvent({
        event: result.code === "QR_ALREADY_USED" ? "PACKAGE_WITHDRAW_REPLAY_BLOCKED"
          : result.code === "QR_EXPIRED" ? "PACKAGE_QR_EXPIRED"
          : "PACKAGE_QR_INVALID",
        timestamp: new Date().toISOString(),
        operation: "retirar/qr",
        result: result.code === "QR_ALREADY_USED" ? "blocked" : "failed",
        condominioId,
        actorUid: uid,
        actorRole,
        method: "QR_CODE",
        correlationId,
        errorCode,
      });
      return jsonError(message, status);
    }

    logEncomendaEvent({
      event: "PACKAGE_WITHDRAW_QR_SUCCESS",
      timestamp: new Date().toISOString(),
      operation: "retirar/qr",
      result: "success",
      condominioId,
      encomendaId: result.encomendaId,
      actorUid: uid,
      actorRole,
      method: "QR_CODE",
      correlationId,
    });

    return NextResponse.json({
      ok: true,
      encomendaId: result.encomendaId,
      message: "Retirada confirmada via QR Code.",
    });
  } catch (err: any) {
    if (err instanceof Response) return err;
    const status = err?.status || 500;
    logEncomendaEvent({
      event: "PACKAGE_QR_INVALID",
      timestamp: new Date().toISOString(),
      operation: "retirar/qr",
      result: "error",
      condominioId: condominioId || null,
      actorUid: null,
      method: "QR_CODE",
      correlationId,
      errorCode: "EXCEPTION",
      errorMessage: err?.message || "Erro inesperado.",
    });
    return jsonError(err?.message || "Erro inesperado.", status);
  }
}
