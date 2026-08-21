/**
 * FASE D.10 — API ADMIN: IMPORTAR REGULAMENTO.
 *
 * POST → valida schema, hash, regras → cria rascunho. NUNCA publica.
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
    const exportData = body?.exportData;

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!exportData || typeof exportData !== "object") return jsonError("exportData é obrigatório.", 400);

    await apiGuard({ request: req, condominioId, allowedRoles: ADMIN_ROLES });

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
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
