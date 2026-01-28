import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { createHash } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
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
    const encomendaId = String(body?.encomendaId || "").trim();
    const codigo = body?.codigo ? String(body.codigo).trim() : "";
    const pin = body?.pin ? String(body.pin).trim() : "";

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!encomendaId) return jsonError("encomendaId é obrigatório", 400);
    if (!codigo && !pin) return jsonError("Informe o código (PKG-...) ou o PIN.", 400);

    const ref = db.collection("condominios").doc(condominioId).collection("encomendas").doc(encomendaId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Encomenda não encontrada.", 404);

    const data = snap.data() as any;
    if (String(data?.status || "") === "RETIRADA") {
      return jsonError("Essa encomenda já foi retirada.", 400);
    }

    const okCodigo = codigo ? sha256(codigo) === String(data?.codigoRetiradaHash || "") : false;
    const okPin = pin ? sha256(pin) === String(data?.pinHash || "") : false;

    if (!okCodigo && !okPin) {
      return jsonError("Código/PIN inválido.", 403);
    }

    await ref.set(
      {
        status: "RETIRADA",
        retiradaEm: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        retiradoPorUid: decoded.uid,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API encomendas/retirar] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
