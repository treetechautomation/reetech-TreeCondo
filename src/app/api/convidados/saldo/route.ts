/** FASE 16.18.2 / R6 — GET /api/convidados/saldo */
import { NextResponse } from "next/server"; export const runtime = "nodejs";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { isUsoCampoEncerrado, releasePendingGuestsForUsoCampoTx } from "@/lib/reservas/convidados-ledger-helper";
import { FieldValue } from "firebase-admin/firestore";

function jerr(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const condominioId = url.searchParams.get("condominioId") ?? "";
  let competencia = url.searchParams.get("competencia") ?? "";
  if (!condominioId) return jerr("condominioId required", 400);

  const auth = req.headers.get("authorization") ?? ""; const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let d; try { d = await adminAuth().verifyIdToken(token); } catch { return jerr("Unauthorized", 401); }
  const uid = String(d.uid); const db = adminDb();

  // Resolve unit from membership (NOT from query params)
  const mRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
  const mSnap = await mRef.get();
  if (!mSnap.exists) return jerr("Membro não encontrado", 403);
  const membro = mSnap.data()!;
  const status = String(membro.status ?? "").toUpperCase();
  if (status !== "ATIVO" && !(d as any)?.super_admin) return jerr("Membro inativo", 403);

  const blocoNorm = String(membro.blocoIdNorm ?? "").toLowerCase().trim();
  const unidNorm = String(membro.unidadeIdNorm ?? "").toLowerCase().trim();
  if (!blocoNorm || !unidNorm) return jerr("Unidade não resolvida", 400);
  const unitKey = `${condominioId}::${blocoNorm}::${unidNorm}`;

  // Validate competencia
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    const now = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    competencia = now.substring(0, 7);
  }

  // Check policy
  const policyRef = db.collection("condominios").doc(condominioId).collection("config").doc("reservasPolicy").collection("dados").doc("publicada");
  const policySnap = await policyRef.get();
  const saldoTotal = policySnap.exists ? ((policySnap.data() as any)?.policy?.convidados?.saldoMensalPorUnidade ?? null) : null;
  if (!saldoTotal) return NextResponse.json({ competencia, total: 0, reservado: 0, consumido: 0, disponivel: 0, habilitado: false });

  // Read or create virtual ledger
  const ledgerRef = db.collection("condominios").doc(condominioId).collection("convidadosLedger").doc(`${unitKey}__${competencia}`);
  const ledgerSnap = await ledgerRef.get();

  // If no ledger, reconcile pending no-shows + return virtual
  let ldata: any = null;
  if (ledgerSnap.exists) {
    // Reconcile no-shows: find entries RESERVADO for this unit/competencia, check if uso ended
    const entriesSnap = await db.collection("condominios").doc(condominioId)
      .collection("convidadosLedgerEntries")
      .where("unitKey", "==", unitKey).where("competencia", "==", competencia)
      .where("status", "==", "RESERVADO").where("origemTipo", "==", "USO_CAMPO").get();

    for (const eDoc of entriesSnap.docs) {
      const e = eDoc.data();
      const usoRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(e.origemId);
      const usoS = await usoRef.get();
      if (!usoS.exists) continue;
      const uso = usoS.data()!;
      if (isUsoCampoEncerrado({ dateStr: uso.dateStr, fimMin: uso.fimMin, status: uso.status }, new Date())) {
        await db.runTransaction(async (tx: any) => {
          await releasePendingGuestsForUsoCampoTx(tx, db, ledgerRef, { condominioId, usoId: e.origemId });
        }).catch(() => {});
      }
    }
    const fresh = await ledgerRef.get();
    ldata = fresh.exists ? fresh.data()! : null;
  }

  if (!ldata) {
    return NextResponse.json({ competencia, total: saldoTotal, reservado: 0, consumido: 0, disponivel: saldoTotal, habilitado: true });
  }

  return NextResponse.json({
    competencia, total: ldata.saldoTotal ?? saldoTotal,
    reservado: ldata.saldoReservado ?? 0, consumido: ldata.saldoConsumido ?? 0,
    disponivel: (ldata.saldoTotal ?? saldoTotal) - (ldata.saldoConsumido ?? 0) - (ldata.saldoReservado ?? 0),
    habilitado: true,
  });
}
