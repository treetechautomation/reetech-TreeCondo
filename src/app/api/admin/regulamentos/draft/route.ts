/**
 * FASE D.10 — API ADMIN: RASCUNHO DE REGULAMENTO.
 *
 * GET  → ler rascunho
 * POST → criar rascunho
 * PUT  → editar rascunho
 * DELETE → descartar rascunho
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard, type GuardRole } from "@/lib/apiGuard";
import { createFirestoreRegulamentoRepository } from "@/lib/reservas/policy-engine/regulamento-firestore";
import { createRegulamentoAdminService } from "@/lib/reservas/policy-engine/regulamento-admin";

const ADMIN_ROLES: GuardRole[] = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO"];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    await apiGuard({ request: req, condominioId, allowedRoles: ADMIN_ROLES });

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const svc = createRegulamentoAdminService(repo);
    const draft = await svc.getDraft(condominioId);
    if (!draft) return jsonError("Nenhum rascunho encontrado.", 404);

    return NextResponse.json({ ok: true, draft });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    await apiGuard({ request: req, condominioId, allowedRoles: ADMIN_ROLES });

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const svc = createRegulamentoAdminService(repo);
    const resultado = await svc.createDraft(condominioId, body);
    return NextResponse.json({ ok: resultado.success, ...resultado });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    await apiGuard({ request: req, condominioId, allowedRoles: ADMIN_ROLES });

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const svc = createRegulamentoAdminService(repo);
    const resultado = await svc.updateDraft(condominioId, body);
    return NextResponse.json({ ok: resultado.success, ...resultado });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    await apiGuard({ request: req, condominioId, allowedRoles: ADMIN_ROLES });

    const db = adminDb();
    const repo = createFirestoreRegulamentoRepository(db);
    const svc = createRegulamentoAdminService(repo);
    const resultado = await svc.discardDraft(condominioId);
    return NextResponse.json({ ok: resultado.success, ...resultado });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", 500);
  }
}
