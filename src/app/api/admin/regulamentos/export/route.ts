/**
 * FASE D.10 — API ADMIN: EXPORTAR REGULAMENTO.
 *
 * GET → JSON portável com hash de integridade.
 * Autenticação via apiGuard (admin com vínculo ativo no condomínio).
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard, type GuardRole } from "@/lib/apiGuard";
import { createFirestoreRegulamentoRepository } from "@/lib/reservas/policy-engine/regulamento-firestore";

const ADMIN_ROLES: GuardRole[] = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO"];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    await apiGuard({ request: req, condominioId, allowedRoles: ADMIN_ROLES });

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const data = await repo.buildExport(condominioId);
    if (!data) return jsonError("Nenhum regulamento publicado para exportar.", 404);

    return NextResponse.json({ ok: true, export: data });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
