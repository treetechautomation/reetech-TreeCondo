/** FASE 16.18 / R6 — POST /api/checkin/registrar (uso comum apenas) */
import { NextResponse } from "next/server"; export const runtime = "nodejs";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { entryId } from "@/lib/reservas/convidados-ledger-helper";

const ALLOWED = new Set(["SUPER_ADMIN","SINDICO","ADMIN","ADMIN_CONDOMINIO","PORTEIRO","SEGURANCA"]);
function jerr(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? ""; const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let d; try { d = await adminAuth().verifyIdToken(token); } catch { return jerr("Unauthorized", 401); }
  const uid = String(d.uid); const db = adminDb();
  let body: any; try { body = await req.json(); } catch { return jerr("Invalid", 400); }
  const condominioId = String(body?.condominioId ?? "").trim();
  const origemTipo = (body?.origemTipo ?? "").trim();
  const origemId = (body?.origemId ?? "").trim();
  const convidadoId = (body?.convidadoId ?? "").trim();
  if (!condominioId || origemTipo !== "USO_CAMPO" || !origemId || !convidadoId) return jerr("Invalid params", 400);

  // Auth role
  const mRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
  const mSnap = await mRef.get();
  const isSuper = (d as any)?.super_admin || (d as any)?.superAdmin;
  const role = mSnap.exists ? String((mSnap.data() as any)?.role ?? "").toUpperCase() : "";
  if (!isSuper && !ALLOWED.has(role)) return jerr("Sem permissão para check-in", 403);

  const checkinId = entryId(origemTipo, origemId, convidadoId);
  const convRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc(origemId).collection("convidados").doc(convidadoId);
  const eRef = db.collection("condominios").doc(condominioId).collection("convidadosLedgerEntries").doc(checkinId);

  await db.runTransaction(async (tx: any) => {
    const cSnap = await tx.get(convRef);
    if (!cSnap.exists) throw Object.assign(new Error("Convidado não encontrado"), { status: 404 });
    const c = cSnap.data()!;
    if (c.status === "CONSUMIDO") return; // already checked in

    const eSnap = await tx.get(eRef);
    const entry = eSnap.exists ? eSnap.data()! : null;
    if (!entry || entry.status !== "RESERVADO") throw Object.assign(new Error("Convidado não está com saldo reservado"), { status: 409 });

    const lKey = (entry as any).unitKey + "__" + (entry as any).competencia;
    const lRef = db.collection("condominios").doc(condominioId).collection("convidadosLedger").doc(lKey);

    const ts = FieldValue.serverTimestamp();
    tx.update(convRef, { status: "CONSUMIDO", checkinEm: ts, checkinPorUid: uid });
    tx.set(eRef, { status: "CONSUMIDO", checkinId, updatedAt: ts }, { merge: true });
    tx.update(lRef, { saldoReservado: FieldValue.increment(-1), saldoConsumido: FieldValue.increment(1), version: FieldValue.increment(1), updatedAt: ts });
  });

  return NextResponse.json({ ok: true, checkinId });
}
