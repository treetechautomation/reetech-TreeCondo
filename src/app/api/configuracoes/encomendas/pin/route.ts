
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

export async function POST(req: Request) {
  const db = adminDb();

  try {
    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();
    const pin = String(body?.pin || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!pin) return jsonError("PIN é obrigatório", 400);

    const pinDigits = pin.replace(/\D/g, "");
    if (pinDigits.length < 4 || pinDigits.length > 8) {
      return jsonError("PIN deve ter de 4 a 8 números.", 400);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "MORADOR"],
      rateLimit: { limit: 10, windowSec: 60 },
    });

    const uid = ctx.uid;
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
        encomendaPinFailedAttempts: 0,
        pinEncomendasHash: pinHash,
        pinEncomendasLast4: pinLast4,
        pinEncomendasUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return NextResponse.json({ ok: true, pinLast4 });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[API/configuracoes/encomendas/pin] Erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
