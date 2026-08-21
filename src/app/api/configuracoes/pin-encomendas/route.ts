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
    const body = (await req.json().catch(() => ({}))) as any;
    const condominioId = String(body?.condominioId || "").trim();
    const pin = String(body?.pin || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!pin || pin.length < 4) return jsonError("PIN inválido (mínimo 4 dígitos).", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "MORADOR"],
      rateLimit: { limit: 10, windowSec: 60 },
    });

    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(ctx.uid);
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
        pinEncomendasHash: pinHash,
        pinEncomendasLast4: pinLast4,
        pinEncomendasUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, pinLast4 });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[API configuracoes/pin-encomendas] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
