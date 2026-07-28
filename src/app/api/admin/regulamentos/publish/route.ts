/**
 * FASE D.10 — API ADMIN: PUBLICAR REGULAMENTO.
 *
 * POST → validar rascunho, incrementar versão, gravar histórico, publicar.
 * Tudo em transação atômica. Concorrência: duas publicações simultâneas
 * nunca geram a mesma versão.
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
    const observacao = String(body?.observacao || "Publicação via API").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    // Verificar permissão
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

    // Obter nome do autor
    let authorNome = decoded.name || decoded.email || uid;
    try {
      const membroSnap = await db.collection("condominios").doc(condominioId).collection("membros").doc(uid).get();
      if (membroSnap.exists) authorNome = membroSnap.data()?.nome || authorNome;
    } catch {}

    const resultado = await svc.publishPolicy({
      condominioId,
      observacao,
      author: { uid, role: isSuper ? "SUPER_ADMIN" : "ADMIN_CONDOMINIO", nome: authorNome, condominioId },
    });

    return NextResponse.json({
      ok: resultado.success,
      version: resultado.version,
      message: resultado.message,
      contentHash: resultado.contentHash,
      snapshot: resultado.snapshot,
    }, { status: resultado.success ? 200 : 409 });
  } catch (err: any) {
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
