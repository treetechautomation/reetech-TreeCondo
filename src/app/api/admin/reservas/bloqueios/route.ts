/**
 * FASE 16.13 / R4 — GET /api/admin/reservas/bloqueios
 *
 * Lista bloqueios ativos do condomínio (gestores).
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const ALLOWED_ROLES = new Set(["SUPER_ADMIN", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const condominioId = url.searchParams.get("condominioId") ?? "";

  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let decoded;
  try { decoded = await adminAuth().verifyIdToken(token); }
  catch { return jsonError("Não autorizado.", 401); }

  const uid = String(decoded.uid);
  const isSuper = (decoded as any)?.super_admin === true || (decoded as any)?.superAdmin === true;
  const db = adminDb();

  if (!isSuper) {
    const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId).get();
    if (!vincSnap.exists) return jsonError("Sem vínculo com o condomínio.", 403);
    const role = String(vincSnap.data()?.role ?? "").toUpperCase();
    if (!ALLOWED_ROLES.has(role)) return jsonError("Sem permissão.", 403);
  }

  const snap = await db.collection("condominios").doc(condominioId)
    .collection("bloqueiosReservas")
    .where("ativo", "==", true)
    .orderBy("criadoEm", "desc")
    .limit(50)
    .get();

  const bloqueios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ ok: true, bloqueios });
}
