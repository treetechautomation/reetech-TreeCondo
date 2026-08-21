/** FASE 16.18 / R6 — POST /api/campo/[usoId]/convidados/remover */
import { NextResponse } from "next/server"; export const runtime = "nodejs";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { entryId } from "@/lib/reservas/convidados-ledger-helper";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function POST(req: Request, { params: p }: any) {
  try {
    const usoId = (p?.usoId ?? "").trim(); if (!usoId) return jsonError("usoId required", 400);

    let body: any; try { body = await req.json(); } catch { return jsonError("Invalid body", 400); }
    const condominioId = String(body?.condominioId ?? "").trim();
    const convidadoId = (body?.convidadoId ?? "").trim();
    if (!condominioId || !convidadoId) return jsonError("condominioId + convidadoId required", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
    });

    const db = adminDb();
    const convRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(usoId).collection("convidados").doc(convidadoId);
    const usoRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(usoId);
    const usoS = await usoRef.get(); if (!usoS.exists) return jsonError("Uso não encontrado", 404);
    const uso = usoS.data()!; if (uso.uid !== ctx.uid && !ctx.isSuperAdmin) return jsonError("Não autorizado", 403);

    const unitKey = `${condominioId}::${(uso.blocoIdNorm ?? "").toLowerCase()}::${(uso.unidadeIdNorm ?? "").toLowerCase()}`;
    const competencia = (uso.dateStr as string).substring(0, 7);

    await db.runTransaction(async (tx: any) => {
      const cSnap = await tx.get(convRef);
      if (!cSnap.exists) throw Object.assign(new Error("Convidado não encontrado"), { status: 404 });
      const c = cSnap.data()!;
      if (c.status === "LIBERADO") return NextResponse.json({ ok: true, already: true });
      if (c.status !== "RESERVADO") throw Object.assign(new Error("Convidado já consumido — não pode ser removido"), { status: 409 });

      const eRef = db.collection("condominios").doc(condominioId).collection("convidadosLedgerEntries").doc(entryId("USO_CAMPO", usoId, convidadoId));
      const lRef = db.collection("condominios").doc(condominioId).collection("convidadosLedger").doc(`${unitKey}__${competencia}`);

      tx.update(convRef, { status: "LIBERADO", liberadoEm: FieldValue.serverTimestamp() });
      tx.set(eRef, { status: "LIBERADO", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.update(lRef, { saldoReservado: FieldValue.increment(-1), saldoDevolvido: FieldValue.increment(1), version: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
