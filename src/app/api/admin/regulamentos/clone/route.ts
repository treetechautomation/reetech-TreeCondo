/**
 * FASE D.10 — API ADMIN: CLONAR REGULAMENTO.
 *
 * POST → copia regulamento de origem para destino como rascunho. NUNCA publica.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard, type GuardRole } from "@/lib/apiGuard";
import { createFirestoreRegulamentoRepository } from "@/lib/reservas/policy-engine/regulamento-firestore";
import { createRegulamentoAdminService } from "@/lib/reservas/policy-engine/regulamento-admin";

const ADMIN_ROLES: GuardRole[] = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO"];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sourceCondominioId = String(body?.sourceCondominioId || "").trim();
    const targetCondominioId = String(body?.targetCondominioId || "").trim();
    const observacao = String(body?.observacao || "Clonagem via API.").trim();
    const overwrite = Boolean(body?.overwrite);

    if (!sourceCondominioId || !targetCondominioId) {
      return jsonError("sourceCondominioId e targetCondominioId são obrigatórios.", 400);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId: targetCondominioId,
      allowedRoles: ADMIN_ROLES,
    });

    const authorNome = ctx.membroData?.nome || ctx.decodedToken?.name || ctx.email || ctx.uid;

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const svc = createRegulamentoAdminService(repo);
    const resultado = await svc.clonePolicy({
      sourceCondominioId, targetCondominioId, overwrite,
      observacao,
      author: { uid: ctx.uid, role: ctx.isSuperAdmin ? "SUPER_ADMIN" : "ADMIN_CONDOMINIO", nome: authorNome, condominioId: targetCondominioId },
    });

    return NextResponse.json({
      ok: resultado.success,
      draftVersion: resultado.draftVersion,
      contentHash: resultado.contentHash,
      differences: resultado.differences,
      error: resultado.error,
    }, { status: resultado.success ? 200 : 409 });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
