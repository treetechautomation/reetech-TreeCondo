/**
 * FASE D.10 — API ADMIN: IMPORTAR REGULAMENTO.
 *
 * POST → valida schema, hash, regras → cria rascunho. NUNCA publica.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { createFirestoreRegulamentoRepository } from "@/lib/reservas/policy-engine/regulamento-firestore";
import { createRegulamentoAdminService } from "@/lib/reservas/policy-engine/regulamento-admin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return jsonError("Token ausente.", 401);

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const isSuper = (decoded as any)?.super_admin === true || (decoded as any)?.superAdmin === true;
    const uid = String(decoded.uid);

    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();
    const exportData = body?.exportData;

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!exportData || typeof exportData !== "object") return jsonError("exportData é obrigatório.", 400);

    if (!isSuper) {
      const db = adminDb();
      const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId).get();
      if (!vincSnap.exists) return jsonError("Sem vínculo com o condomínio.", 403);
      const role = String(vincSnap.data()?.role || "").toUpperCase();
      if (!["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role)) {
        return jsonError("Permissão insuficiente.", 403);
      }
    }

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const svc = createRegulamentoAdminService(repo);
    const resultado = await svc.importPolicy(condominioId, exportData);

    return NextResponse.json({
      ok: resultado.success,
      validation: resultado.validation,
      draftVersion: resultado.draftVersion,
    }, { status: resultado.success ? 200 : 422 });
  } catch (err: any) {
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
