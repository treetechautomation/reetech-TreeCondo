
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { createHash } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);

    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();
    const pin = String(body?.pin || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!pin) return jsonError("PIN é obrigatório", 400);

    const pinDigits = pin.replace(/\D/g, "");
    if (pinDigits.length < 4 || pinDigits.length > 8) {
      return jsonError("PIN deve ter de 4 a 8 números.", 400);
    }

    const uid = decoded.uid;
    const pinHash = sha256(pinDigits);
    const pinLast4 = pinDigits.slice(-4);

    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(membroRef);
      if (!snap.exists) throw new Error("Você não é membro deste condomínio.");

      tx.set(membroRef, {
        encomendaPinHash: pinHash,
        encomendaPinLast4: pinLast4,
        encomendaPinUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return NextResponse.json({ ok: true, pinLast4 });
  } catch (err: any) {
    console.error("[API/configuracoes/encomendas/pin] Erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
