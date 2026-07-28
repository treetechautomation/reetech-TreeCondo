/**
 * FASE E.3.2.3 — POST /api/encomendas/credencial
 *
 * Emissão autorizada de credencial (QR ou PIN) para o MORADOR.
 * Apenas o morador vinculado à unidade da encomenda pode obter credenciais.
 * O token/PIN bruto NUNCA é persistido.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import {
  generatePin,
  hashPin,
  last4,
  generateQRToken,
  hashQRToken,
} from "@/lib/encomendas/withdrawal";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();
  const correlationId = extractCorrelationId(req);

  try {
    // 1. Autenticar
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente.", 401);

    const decoded = await aauth.verifyIdToken(token);
    const uid = String(decoded.uid);

    const body = await req.json().catch(() => ({}));
    const encomendaId = String(body?.encomendaId || "").trim();
    const tipo = String(body?.tipo || "QR").toUpperCase(); // "QR" | "PIN"

    if (!encomendaId) return jsonError("encomendaId é obrigatório.", 400);
    if (tipo !== "QR" && tipo !== "PIN") return jsonError("tipo deve ser QR ou PIN.", 400);

    // 2. Carregar encomenda
    const encomendaSnap = await db.collection("grupo").doc("global").get().catch(() => null);
    // Search all condominios — but we need condominioId. Let user provide it.
    const condominioId = String(body?.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const encomendaRef = db.collection("condominios").doc(condominioId)
      .collection("encomendas").doc(encomendaId);
    const encomendaDoc = await encomendaRef.get();

    if (!encomendaDoc.exists) return jsonError("Encomenda não encontrada.", 404);

    const ed = encomendaDoc.data() || {};
    const encomendaUnidadeNorm = String(ed.unidadeIdNorm || ed.unidadeId || "");

    // 3. Verificar vínculo do morador com a unidade
    const membroSnap = await db.collection("condominios").doc(condominioId)
      .collection("membros").doc(uid).get();

    if (!membroSnap.exists) return jsonError("Morador não encontrado neste condomínio.", 403);

    const md = membroSnap.data() || {};
    const membroUnidadeNorm = String(md.unidadeIdNorm || md.unidadeId || "");
    const membroStatus = String(md.status || "").toUpperCase();

    if (membroStatus !== "ATIVO" && membroStatus !== "PENDENTE") {
      return jsonError("Morador inativo.", 403);
    }

    // 4. Isolamento: morador deve pertencer à unidade da encomenda
    if (!encomendaUnidadeNorm || membroUnidadeNorm !== encomendaUnidadeNorm) {
      return jsonError("Esta encomenda não pertence à sua unidade.", 403);
    }

    // 5. Verificar status da encomenda
    const status = String(ed.status || "").toUpperCase();
    if (status === "RETIRADA" || status === "CANCELADA") {
      return jsonError(`Encomenda com status ${status} não pode gerar credencial.`, 409);
    }

    // 6. Emitir credencial
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

    // PIN
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
