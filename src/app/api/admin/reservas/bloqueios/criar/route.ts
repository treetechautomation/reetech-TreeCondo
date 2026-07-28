/**
 * FASE 16.13 / R4 — POST /api/admin/reservas/bloqueios/criar
 * FASE 16.14 / R4.1 — transactional with coordinator touch.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { touchBlockCoordinators } from "@/lib/reservas/bloqueios-helper";

const ALLOWED_ROLES = new Set(["SUPER_ADMIN", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"]);
const VALID_SCOPES = new Set(["TODAS_AS_AREAS", "RESERVAS_PRIVATIVAS", "USO_CAMPO", "AREA_ESPECIFICA"]);
const VALID_TARGETS = new Set(["UNIDADE", "UID"]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let decoded;
  try { decoded = await adminAuth().verifyIdToken(token); }
  catch { return jsonError("Não autorizado.", 401); }

  const uid = String(decoded.uid);
  const isSuper = (decoded as any)?.super_admin === true || (decoded as any)?.superAdmin === true;
  const db = adminDb();

  let body: any;
  try { body = await req.json(); } catch { return jsonError("Body inválido.", 400); }

  const condominioId = String(body?.condominioId ?? "").trim();
  const tipoAlvo = String(body?.tipoAlvo ?? "").trim().toUpperCase();
  const escopo = String(body?.escopo ?? "").trim().toUpperCase();
  const motivoPublico = String(body?.motivoPublico ?? "").trim();
  const motivoInterno = String(body?.motivoInterno ?? "").trim() || null;
  const areaId = String(body?.areaId ?? "").trim() || null;

  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

  if (!isSuper) {
    const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId).get();
    if (!vincSnap.exists) return jsonError("Sem vínculo.", 403);
    if (!ALLOWED_ROLES.has(String(vincSnap.data()?.role ?? "").toUpperCase())) return jsonError("Sem permissão.", 403);
  }

  if (!VALID_TARGETS.has(tipoAlvo)) return jsonError("tipoAlvo inválido.", 400);
  if (!VALID_SCOPES.has(escopo)) return jsonError("escopo inválido.", 400);
  if (!motivoPublico) return jsonError("motivoPublico é obrigatório.", 400);

  let inicioEm: Date;
  try { inicioEm = new Date(body?.inicioEm); if (isNaN(inicioEm.getTime())) throw new Error(); }
  catch { inicioEm = new Date(); }

  let fimEm: Date | null = null;
  if (body?.fimEm) {
    try { fimEm = new Date(body.fimEm); if (isNaN(fimEm.getTime())) fimEm = null; }
    catch { fimEm = null; }
    if (fimEm && fimEm <= inicioEm) return jsonError("fimEm deve ser posterior a inicioEm.", 400);
  }

  let unidadeIdNorm: string | null = null;
  let blocoIdNorm: string | null = null;
  let targetUid: string | null = null;

  if (tipoAlvo === "UNIDADE") {
    unidadeIdNorm = String(body?.unidadeIdNorm ?? "").trim();
    blocoIdNorm = String(body?.blocoIdNorm ?? "").trim();
    if (!unidadeIdNorm || !blocoIdNorm) return jsonError("unidadeIdNorm e blocoIdNorm são obrigatórios.", 400);
  } else {
    targetUid = String(body?.uid ?? "").trim();
    if (!targetUid) return jsonError("uid é obrigatório.", 400);
  }

  if (escopo === "AREA_ESPECIFICA" && !areaId) return jsonError("areaId é obrigatório.", 400);

  const colRef = db.collection("condominios").doc(condominioId).collection("bloqueiosReservas");
  const docRef = colRef.doc();

  // Transaction: criar bloqueio + touch nos coordenadores afetados
  await db.runTransaction(async (tx: any) => {
    const ts = FieldValue.serverTimestamp();
    tx.set(docRef, {
      tipoAlvo, unidadeIdNorm, blocoIdNorm, uid: targetUid,
      escopo, areaId, ativo: true,
      motivoPublico, motivoInterno,
      inicioEm: Timestamp.fromDate(inicioEm),
      fimEm: fimEm ? Timestamp.fromDate(fimEm) : null,
      criadoEm: ts, criadoPorUid: uid,
      revogadoEm: null, revogadoPorUid: null, updatedAt: ts,
    });

    touchBlockCoordinators(tx, db, condominioId, targetUid, blocoIdNorm, unidadeIdNorm);
  });

  return jsonOk({ ok: true, bloqueioId: docRef.id });
}
