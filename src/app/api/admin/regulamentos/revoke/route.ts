/**
 * FASE D.10 — API ADMIN: REVOGAR REGULAMENTO.
 *
 * POST → marca a versão publicada como REVOGADA. Jamais apaga.
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
    const observacao = String(body?.observacao || "Revogação via API").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({ request: req, condominioId, allowedRoles: ADMIN_ROLES });

    const authorNome = ctx.membroData?.nome || ctx.decodedToken?.name || ctx.email || ctx.uid;

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const svc = createRegulamentoAdminService(repo);
    const resultado = await svc.revokePolicy({
      condominioId, observacao,
      author: { uid: ctx.uid, role: ctx.isSuperAdmin ? "SUPER_ADMIN" : "ADMIN_CONDOMINIO", nome: authorNome, condominioId },
    });

    return NextResponse.json({ ok: resultado.success, ...resultado });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
