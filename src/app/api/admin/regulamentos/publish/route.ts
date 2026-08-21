/**
 * FASE D.10 — API ADMIN: PUBLICAR REGULAMENTO.
 *
 * POST → validar rascunho, incrementar versão, gravar histórico, publicar.
 * Tudo em transação atômica. Concorrência: duas publicações simultâneas
 * nunca geram a mesma versão.
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
    const condominioId = String(body?.condominioId || "").trim();
    const observacao = String(body?.observacao || "Publicação via API").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({ request: req, condominioId, allowedRoles: ADMIN_ROLES });

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const svc = createRegulamentoAdminService(repo);

    const authorNome = ctx.membroData?.nome || ctx.decodedToken?.name || ctx.email || ctx.uid;

    const resultado = await svc.publishPolicy({
      condominioId,
      observacao,
      author: { uid: ctx.uid, role: ctx.isSuperAdmin ? "SUPER_ADMIN" : "ADMIN_CONDOMINIO", nome: authorNome, condominioId },
    });

    return NextResponse.json({
      ok: resultado.success,
      version: resultado.version,
      message: resultado.message,
      contentHash: resultado.contentHash,
      snapshot: resultado.snapshot,
    }, { status: resultado.success ? 200 : 409 });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
