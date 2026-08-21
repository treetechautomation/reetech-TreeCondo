/** FASE 16.18 / R6 — POST /api/checkin/registrar (uso comum apenas) */
import { NextResponse } from "next/server"; export const runtime = "nodejs";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { entryId } from "@/lib/reservas/convidados-ledger-helper";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function POST(req: Request) {
  try {
  let body: any; try { body = await req.json(); } catch { return jsonError("Invalid", 400); }
  const condominioId = String(body?.condominioId ?? "").trim();
  const origemTipo = (body?.origemTipo ?? "").trim();
  const origemId = (body?.origemId ?? "").trim();
  const convidadoId = (body?.convidadoId ?? "").trim();
  if (!condominioId || origemTipo !== "USO_CAMPO" || !origemId || !convidadoId) return jsonError("Invalid params", 400);

  const ctx = await apiGuard({
    request: req,
    condominioId,
    allowedRoles: ["SUPER_ADMIN", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "PORTEIRO", "SEGURANCA"],
  });

  const db = adminDb();
  const checkinId = entryId(origemTipo, origemId, convidadoId);
  const convRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(origemId).collection("convidados").doc(convidadoId);
  const eRef = db.collection("condominios").doc(condominioId).collection("convidadosLedgerEntries").doc(checkinId);

  await db.runTransaction(async (tx: any) => {
    const cSnap = await tx.get(convRef);
    if (!cSnap.exists) throw Object.assign(new Error("Convidado não encontrado"), { status: 404 });
    const c = cSnap.data()!;
    if (c.status === "CONSUMIDO") return;

    const eSnap = await tx.get(eRef);
    const entry = eSnap.exists ? eSnap.data()! : null;
    if (!entry || entry.status !== "RESERVADO") throw Object.assign(new Error("Convidado não está com saldo reservado"), { status: 409 });

    const lKey = (entry as any).unitKey + "__" + (entry as any).competencia;
    const lRef = db.collection("condominios").doc(condominioId).collection("convidadosLedger").doc(lKey);

    const ts = FieldValue.serverTimestamp();
    tx.update(convRef, { status: "CONSUMIDO", checkinEm: ts, checkinPorUid: ctx.uid });
    tx.set(eRef, { status: "CONSUMIDO", checkinId, updatedAt: ts }, { merge: true });
    tx.update(lRef, { saldoReservado: FieldValue.increment(-1), saldoConsumido: FieldValue.increment(1), version: FieldValue.increment(1), updatedAt: ts });
  });

  return NextResponse.json({ ok: true, checkinId });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
