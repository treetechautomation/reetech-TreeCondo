/**
 * FASE 16.16 / R5 — PATCH /api/admin/reservas/areas/[areaId]/preco
 *
 * Altera preço base de uma área reservável. Somente gestores.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const ALLOWED_ROLES = new Set(["SUPER_ADMIN", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function PATCH(req: Request, { params }: any) {
  const areaId = String(params?.areaId ?? "").trim();
  if (!areaId) return jsonError("areaId é obrigatório.", 400);

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
  const precoCentavos = Number(body?.precoCentavos);

  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
  if (!Number.isFinite(precoCentavos) || !Number.isInteger(precoCentavos) || precoCentavos < 0) {
    return jsonError("precoCentavos deve ser um inteiro não negativo.", 400);
  }

  if (!isSuper) {
    const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId).get();
    if (!vincSnap.exists) return jsonError("Sem vínculo.", 403);
    if (!ALLOWED_ROLES.has(String(vincSnap.data()?.role ?? "").toUpperCase())) return jsonError("Sem permissão.", 403);
  }

  const areaRef = db.collection("condominios").doc(condominioId).collection("areasReservaveis").doc(areaId);
  const areaSnap = await areaRef.get();
  if (!areaSnap.exists) return jsonError("Área não encontrada.", 404);

  const area = areaSnap.data()!;

  // Campo é gratuito e não deve ter preço editável
  if ((area as any).ehUsoComum === true) {
    return jsonError("Área de uso comum não possui preço editável.", 400);
  }

  const valorAnterior = Number(area.precoCentavos ?? area.preco ?? 0);

  // Atualizar preço + criar histórico
  const ts = FieldValue.serverTimestamp();
  const historicoRef = areaRef.collection("historicoPrecos").doc();

  await db.runTransaction(async (tx: any) => {
    tx.update(areaRef, { precoCentavos, preco: precoCentavos, updatedAt: ts });
    tx.set(historicoRef, {
      areaId,
      opcaoId: null,
      valorAnteriorCentavos: valorAnterior,
      valorNovoCentavos: precoCentavos,
      alteradoPorUid: uid,
      alteradoEm: ts,
    });
  });

  return NextResponse.json({ ok: true, precoCentavos });
}
