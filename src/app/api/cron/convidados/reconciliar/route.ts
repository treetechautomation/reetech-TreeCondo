/** FASE 16.18 / R6 — POST /api/cron/convidados/reconciliar */
import { NextResponse } from "next/server"; export const runtime = "nodejs";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { isUsoCampoEncerrado, entryId } from "@/lib/reservas/convidados-ledger-helper";

function jerr(m: string, s = 400) { return NextResponse.json({ success: false, error: m }, { status: s }); }

export async function POST(req: Request) {
  const secret = process.env.CRON_RESERVAS_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) return jerr("Unauthorized", 401);
  const db = adminDb(); const now = new Date(); let reconciliados = 0;

  const condSnap = await db.collection("condominiosPublicos").orderBy("nome").get();
  for (const cond of condSnap.docs) {
    const cid = cond.id; let lastDoc: any = null; let page = 0;
    while (page < 10) {
      let q: any = db.collection("condominios").doc(cid).collection("usoCampo").where("status", "==", "ATIVO").where("dateStr", "<=", new Date().toISOString().slice(0, 10)).orderBy("dateStr", "asc").limit(100);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get(); if (snap.empty) break;
      for (const doc of snap.docs) {
        const u = doc.data();
        if (!isUsoCampoEncerrado({ dateStr: u.dateStr, fimMin: u.fimMin }, now)) continue;
        const gSnap = await doc.ref.collection("convidados").where("status", "==", "RESERVADO").get();
        if (gSnap.empty) continue;
        const unitKey = `${cid}::${(u.blocoIdNorm ?? "").toLowerCase()}::${(u.unidadeIdNorm ?? "").toLowerCase()}`;
        const comp = (u.dateStr as string).substring(0, 7);
        const lRef = db.collection("condominios").doc(cid).collection("convidadosLedger").doc(`${unitKey}__${comp}`);
        await db.runTransaction(async (tx: any) => {
          let count = 0;
          for (const g of gSnap.docs) {
            const gd = g.data(); if (gd.status !== "RESERVADO") continue;
            tx.update(g.ref, { status: "LIBERADO", liberadoEm: FieldValue.serverTimestamp() });
            tx.set(db.collection("condominios").doc(cid).collection("convidadosLedgerEntries").doc(entryId("USO_CAMPO", doc.id, g.id)), { status: "LIBERADO", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            count++;
          }
          if (count > 0) tx.update(lRef, { saldoReservado: FieldValue.increment(-count), saldoDevolvido: FieldValue.increment(count), version: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
          reconciliados += count;
        });
      }
      lastDoc = snap.docs[snap.docs.length - 1]; page++;
    }
  }
  return NextResponse.json({ success: true, reconciliados });
}
