/** FASE 16.18.2 / R6 — GET /api/convidados/saldo */
import { NextResponse } from "next/server"; export const runtime = "nodejs";
import { adminDb } from "@/lib/firebaseAdmin";
import { isUsoCampoEncerrado, releasePendingGuestsForUsoCampoTx } from "@/lib/reservas/convidados-ledger-helper";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function GET(req: Request) {
  const db = adminDb();

  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") ?? "";
    let competencia = url.searchParams.get("competencia") ?? "";
    if (!condominioId) return jsonError("condominioId required", 400);

    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
      const now = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      competencia = now.substring(0, 7);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "MORADOR"],
      rateLimit: { limit: 30, windowSec: 60 },
    });

    const uid = ctx.uid;
    const membro = ctx.membroData!;

    const blocoNorm = String(membro.blocoIdNorm ?? "").toLowerCase().trim();
    const unidNorm = String(membro.unidadeIdNorm ?? "").toLowerCase().trim();
    if (!blocoNorm || !unidNorm) return jsonError("Unidade não resolvida", 400);
    const unitKey = `${condominioId}::${blocoNorm}::${unidNorm}`;

    const policyRef = db.collection("condominios").doc(condominioId).collection("config").doc("reservasPolicy").collection("dados").doc("publicada");
    const policySnap = await policyRef.get();
    const saldoTotal = policySnap.exists ? ((policySnap.data() as any)?.policy?.convidados?.saldoMensalPorUnidade ?? null) : null;
    if (!saldoTotal) return NextResponse.json({ competencia, total: 0, reservado: 0, consumido: 0, disponivel: 0, habilitado: false });

    const ledgerRef = db.collection("condominios").doc(condominioId).collection("convidadosLedger").doc(`${unitKey}__${competencia}`);
    const ledgerSnap = await ledgerRef.get();

    let ldata: any = null;
    if (ledgerSnap.exists) {
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
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[API/convidados/saldo] Erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
