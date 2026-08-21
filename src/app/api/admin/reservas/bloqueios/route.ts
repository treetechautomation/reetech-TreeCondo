/**
 * FASE 16.13 / R4 — GET /api/admin/reservas/bloqueios
 *
 * Lista bloqueios ativos do condomínio (gestores).
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ALLOWED_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") ?? "";

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ALLOWED_ROLES,
    });

    const db = adminDb();

    const snap = await db.collection("condominios").doc(condominioId)
      .collection("bloqueiosReservas")
      .where("ativo", "==", true)
      .orderBy("criadoEm", "desc")
      .limit(50)
      .get();

    const bloqueios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ ok: true, bloqueios });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
