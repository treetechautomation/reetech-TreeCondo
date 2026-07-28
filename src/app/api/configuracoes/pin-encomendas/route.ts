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
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body?.condominioId || "").trim();
    const pin = String(body?.pin || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!pin || pin.length < 4) return jsonError("PIN inválido (mínimo 4 dígitos).", 400);

    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(decoded.uid);
    const snap = await membroRef.get();
    if (!snap.exists) return jsonError("Vínculo do morador não encontrado nesse condomínio.", 404);

    const pinHash = sha256(pin);
    const pinLast4 = pin.slice(-4);

    await membroRef.set(
      {
        encomendaPinHash: pinHash,
        encomendaPinLast4: pinLast4,
        encomendaPinUpdatedAt: FieldValue.serverTimestamp(),
        encomendaPinFailedAttempts: 0,
        // Legado / Fallback
        pinEncomendasHash: pinHash,
        pinEncomendasLast4: pinLast4,
        pinEncomendasUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, pinLast4 });
  } catch (err: any) {
    console.error("[API configuracoes/pin-encomendas] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
