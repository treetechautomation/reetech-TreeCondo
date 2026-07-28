/**
 * FASE D.10 — API ADMIN: CLONAR REGULAMENTO.
 *
 * POST → copia regulamento de origem para destino como rascunho. NUNCA publica.
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
    const sourceCondominioId = String(body?.sourceCondominioId || "").trim();
    const targetCondominioId = String(body?.targetCondominioId || "").trim();
    const observacao = String(body?.observacao || "Clonagem via API.").trim();
    const overwrite = Boolean(body?.overwrite);

    if (!sourceCondominioId || !targetCondominioId) {
      return jsonError("sourceCondominioId e targetCondominioId são obrigatórios.", 400);
    }

    if (!isSuper) {
      const db = adminDb();
      const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(targetCondominioId).get();
      if (!vincSnap.exists) return jsonError("Sem vínculo com o condomínio de destino.", 403);
      const role = String(vincSnap.data()?.role || "").toUpperCase();
      if (!["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role)) {
        return jsonError("Permissão insuficiente no destino.", 403);
      }
    }

    let authorNome = decoded.name || decoded.email || uid;
    try {
      const db = adminDb();
      const membroSnap = await db.collection("condominios").doc(targetCondominioId).collection("membros").doc(uid).get();
      if (membroSnap.exists) authorNome = membroSnap.data()?.nome || authorNome;
    } catch {}

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const svc = createRegulamentoAdminService(repo);
    const resultado = await svc.clonePolicy({
      sourceCondominioId, targetCondominioId, overwrite,
      observacao,
      author: { uid, role: isSuper ? "SUPER_ADMIN" : "ADMIN_CONDOMINIO", nome: authorNome, condominioId: targetCondominioId },
    });

    return NextResponse.json({
      ok: resultado.success,
      draftVersion: resultado.draftVersion,
      contentHash: resultado.contentHash,
      differences: resultado.differences,
      error: resultado.error,
    }, { status: resultado.success ? 200 : 409 });
  } catch (err: any) {
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
