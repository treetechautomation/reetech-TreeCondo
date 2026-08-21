import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { generatePin, hashPin, last4, generateQRToken, hashQRToken } from "@/lib/encomendas/withdrawal";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function POST(req: Request) {
  const db = adminDb();
  const correlationId = extractCorrelationId(req);

  try {
    const body = await req.json().catch(() => ({}));
    const encomendaId = String(body?.encomendaId || "").trim();
    const tipo = String(body?.tipo || "QR").toUpperCase();
    const condominioId = String(body?.condominioId || "").trim();

    if (!encomendaId) return jsonError("encomendaId é obrigatório.", 400);
    if (tipo !== "QR" && tipo !== "PIN") return jsonError("tipo deve ser QR ou PIN.", 400);
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
    });

    const uid = ctx.uid;
    const md = ctx.membroData || {};
    const membroUnidadeNorm = String(md.unidadeIdNorm || md.unidadeId || "");

    const encomendaRef = db.collection("condominios").doc(condominioId)
      .collection("encomendas").doc(encomendaId);
    const encomendaDoc = await encomendaRef.get();

    if (!encomendaDoc.exists) return jsonError("Encomenda não encontrada.", 404);

    const ed = encomendaDoc.data() || {};
    const encomendaUnidadeNorm = String(ed.unidadeIdNorm || ed.unidadeId || "");

    if (!encomendaUnidadeNorm || membroUnidadeNorm !== encomendaUnidadeNorm) {
      return jsonError("Esta encomenda não pertence à sua unidade.", 403);
    }

    const status = String(ed.status || "").toUpperCase();
    if (status === "RETIRADA" || status === "CANCELADA") {
      return jsonError(`Encomenda com status ${status} não pode gerar credencial.`, 409);
    }

    const now = new Date().toISOString();

    if (tipo === "QR") {
      const qr = generateQRToken(72 * 60);
      const qrHash = qr.hash;

      await encomendaRef.update({
        qrTokenHash: qrHash,
        qrIssuedAt: now,
        qrExpiresAt: qr.expiresAt.toISOString(),
        qrUsed: false,
        qrUsedAt: null,
        qrRevokedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      logEncomendaEvent({
        event: "PACKAGE_QR_ISSUED",
        timestamp: new Date().toISOString(),
        operation: "credencial",
        result: "success",
        condominioId,
        encomendaId,
        actorUid: uid,
        actorRole: "MORADOR",
        method: "QR_CODE",
        correlationId,
      });

      return NextResponse.json({
        ok: true,
        type: "QR",
        qrToken: qr.token,
        expiresAt: qr.expiresAt.toISOString(),
      });
    }

    const pinRaw = generatePin(4);
    const pinHashVal = hashPin(pinRaw);

    await encomendaRef.update({
      pinHash: pinHashVal,
      pinLast4: last4(pinRaw),
      pinExpiresAt: new Date(Date.now() + 72 * 3600000).toISOString(),
      pinAttempts: 0,
      pinLockedUntil: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logEncomendaEvent({
      event: "PACKAGE_PIN_ISSUED",
      timestamp: new Date().toISOString(),
      operation: "credencial",
      result: "success",
      condominioId,
      encomendaId,
      actorUid: uid,
      actorRole: "MORADOR",
      method: "PIN",
      correlationId,
    });

    return NextResponse.json({
      ok: true,
      type: "PIN",
      pin: pinRaw,
      pinLast4: last4(pinRaw),
    });
  } catch (err: any) {
    if (err instanceof Response) return err;
    logEncomendaEvent({
      event: "PACKAGE_CREATE_FAILED",
      timestamp: new Date().toISOString(),
      operation: "credencial",
      result: "error",
      condominioId: null,
      encomendaId: null,
      errorCode: String(err?.status || 500),
      errorMessage: err?.message || "Erro inesperado.",
      correlationId,
    });
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
