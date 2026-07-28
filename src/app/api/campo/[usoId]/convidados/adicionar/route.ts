/** FASE 16.18 / R6 — POST /api/campo/[usoId]/convidados/adicionar */
import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { getOrCreateLedgerTx, entryId, disponivel } from "@/lib/reservas/convidados-ledger-helper";

function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

export async function POST(req: Request, { params: p }: any) {
  const usoId = (p?.usoId ?? "").trim(); if (!usoId) return jsonError("usoId required", 400);
  const auth = req.headers.get("authorization") ?? ""; const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let decoded; try { decoded = await adminAuth().verifyIdToken(token); } catch { return jsonError("Unauthorized", 401); }
  const uid = String(decoded.uid); const db = adminDb();
  let body: any; try { body = await req.json(); } catch { return jsonError("Invalid body", 400); }
  const condominioId = String(body?.condominioId ?? "").trim();
  const nome = String(body?.nome ?? "").trim();
  const documento = String(body?.documento ?? "").trim() || null;
  const requestKey = String(body?.requestKey ?? "").trim();
  if (!condominioId || !nome) return jsonError("condominioId + nome required", 400);

  const usoRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(usoId);
  const usoSnap = await usoRef.get();
  if (!usoSnap.exists) return jsonError("Uso não encontrado", 404);
  const uso = usoSnap.data()!;
  if (uso.uid !== uid && !(decoded as any)?.super_admin) return jsonError("Não autorizado", 403);
  if (uso.status !== "ATIVO") return jsonError("Uso não está ativo", 400);

  // resolver unitKey, competencia, policy
  const unitKey = `${condominioId}::${(uso.blocoIdNorm ?? "").toLowerCase()}::${(uso.unidadeIdNorm ?? "").toLowerCase()}`;
  const competencia = (uso.dateStr as string).substring(0, 7);
  
  // Check ehUsoComum via areasReservaveis/quadra
  const areaRef = db.collection("condominios").doc(condominioId).collection("areasReservaveis").doc("quadra");
  const areaSnap = await areaRef.get();
  if (!areaSnap.exists || !(areaSnap.data() as any)?.ehUsoComum) return jsonError("Área não é de uso comum", 400);

  // Get policy for saldo
  const policyRef = db.collection("condominios").doc(condominioId).collection("config").doc("reservasPolicy").collection("dados").doc("publicada");
  const policySnap = await policyRef.get();
  const saldoTotal = policySnap.exists ? ((policySnap.data() as any)?.policy?.convidados?.saldoMensalPorUnidade ?? 8) : 8;

  const convidadoRef = usoRef.collection("convidados").doc();

  await db.runTransaction(async (tx: any) => {
    // idempotency: check requestKey
    if (requestKey) {
      const existing = await tx.get(usoRef.collection("convidados").where("requestKey", "==", requestKey));
      if (!existing.empty) return;
    }

    const { ref: ledgerRef, data: ledger } = await getOrCreateLedgerTx(tx, db, {
      condominioId, unitKey, competencia,
      blocoIdNorm: uso.blocoIdNorm ?? "", unidadeIdNorm: uso.unidadeIdNorm ?? "",
      saldoTotal,
    });
    const freshSnap = await tx.get(ledgerRef);
    const fresh = freshSnap.data()!;

    if (disponivel(fresh) < 1) {
      throw Object.assign(new Error("Saldo mensal de convidados excedido."), { status: 409 });
    }

    const ts = FieldValue.serverTimestamp();
    tx.set(convidadoRef, {
      nome, documento, status: "RESERVADO",
      ledgerEntryId: entryId("USO_CAMPO", usoId, convidadoRef.id),
      requestKey: requestKey || null,
      criadoEm: ts, criadoPorUid: uid,
      checkinEm: null, checkinPorUid: null, liberadoEm: null,
    });

    const entryRef = db.collection("condominios").doc(condominioId)
      .collection("convidadosLedgerEntries").doc(entryId("USO_CAMPO", usoId, convidadoRef.id));
    tx.set(entryRef, {
      unitKey, competencia, origemTipo: "USO_CAMPO", origemId: usoId, convidadoId: convidadoRef.id,
      status: "RESERVADO", checkinId: null, createdAt: ts, updatedAt: ts,
    });

    tx.update(ledgerRef, {
      saldoReservado: FieldValue.increment(1),
      version: FieldValue.increment(1),
      updatedAt: ts,
    });
  });

  return NextResponse.json({ ok: true, convidadoId: convidadoRef.id });
}
