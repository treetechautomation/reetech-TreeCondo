/** FASE 16.18 / R6 — POST /api/campo/[usoId]/convidados/remover */
import { NextResponse } from "next/server"; export const runtime = "nodejs";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { entryId } from "@/lib/reservas/convidados-ledger-helper";

function jerr(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function POST(req: Request, { params: p }: any) {
  const usoId = (p?.usoId ?? "").trim(); if (!usoId) return jerr("usoId required", 400);
  const auth = req.headers.get("authorization") ?? ""; const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let d; try { d = await adminAuth().verifyIdToken(token); } catch { return jerr("Unauthorized", 401); }
  const uid = String(d.uid); const db = adminDb();
  let body: any; try { body = await req.json(); } catch { return jerr("Invalid body", 400); }
  const condominioId = String(body?.condominioId ?? "").trim();
  const convidadoId = (body?.convidadoId ?? "").trim();
  if (!condominioId || !convidadoId) return jerr("condominioId + convidadoId required", 400);

  const convRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(usoId).collection("convidados").doc(convidadoId);
  const usoRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(usoId);
  const usoS = await usoRef.get(); if (!usoS.exists) return jerr("Uso não encontrado", 404);
  const uso = usoS.data()!; if (uso.uid !== uid) return jerr("Não autorizado", 403);

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
}
