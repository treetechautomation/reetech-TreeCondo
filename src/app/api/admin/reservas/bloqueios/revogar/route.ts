/**
 * FASE 16.13 / R4 — POST /api/admin/reservas/bloqueios/revogar
 * FASE 16.14 / R4.1 — transactional with coordinator touch, idempotent.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { touchBlockCoordinators } from "@/lib/reservas/bloqueios-helper";

const ALLOWED_ROLES = new Set(["SUPER_ADMIN", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"]);

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
  const bloqueioId = String(body?.bloqueioId ?? "").trim();

  if (!condominioId || !bloqueioId) return jsonError("condominioId e bloqueioId são obrigatórios.", 400);

  if (!isSuper) {
    const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId).get();
    if (!vincSnap.exists) return jsonError("Sem vínculo.", 403);
    if (!ALLOWED_ROLES.has(String(vincSnap.data()?.role ?? "").toUpperCase())) return jsonError("Sem permissão.", 403);
  }

  const ref = db.collection("condominios").doc(condominioId).collection("bloqueiosReservas").doc(bloqueioId);

  // Transaction: revogar + touch nos coordenadores
  await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw Object.assign(new Error("Bloqueio não encontrado."), { status: 404 });

    const b = snap.data()!;
    if (!b.ativo) return; // idempotent — already revoked

    tx.update(ref, {
      ativo: false,
      revogadoEm: FieldValue.serverTimestamp(),
      revogadoPorUid: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    touchBlockCoordinators(tx, db, condominioId, b.uid ?? null, b.blocoIdNorm ?? null, b.unidadeIdNorm ?? null);
  });

  return jsonOk({ ok: true });
}
