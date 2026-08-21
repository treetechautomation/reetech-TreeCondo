/**
 * FASE 16.13 / R4 — POST /api/admin/reservas/bloqueios/revogar
 * FASE 16.14 / R4.1 — transactional with coordinator touch, idempotent.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { touchBlockCoordinators } from "@/lib/reservas/bloqueios-helper";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ALLOWED_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function POST(req: Request) {
  try {
    let body: any;
    try { body = await req.json(); } catch { return jsonError("Body inválido.", 400); }

    const condominioId = String(body?.condominioId ?? "").trim();
    const bloqueioId = String(body?.bloqueioId ?? "").trim();

    if (!condominioId || !bloqueioId) return jsonError("condominioId e bloqueioId são obrigatórios.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ALLOWED_ROLES,
    });

    const db = adminDb();
    const ref = db.collection("condominios").doc(condominioId).collection("bloqueiosReservas").doc(bloqueioId);

    await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error("Bloqueio não encontrado."), { status: 404 });

      const b = snap.data()!;
      if (!b.ativo) return;

      tx.update(ref, {
        ativo: false,
        revogadoEm: FieldValue.serverTimestamp(),
        revogadoPorUid: ctx.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      touchBlockCoordinators(tx, db, condominioId, b.uid ?? null, b.blocoIdNorm ?? null, b.unidadeIdNorm ?? null);
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
