/**
 * ACCESS.4 — POST cria autorização de acesso (MORADOR AUTORIZA).
 *             GET  lista as autorizações do próprio ator.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { AccessApiError } from "@/lib/access/apiErrors";
import { createAuthorization, listOwnAuthorizations } from "@/lib/access/authorizationService";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const condominioId = String(body?.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["MORADOR", "ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "SUPER_ADMIN"],
    });

    const db = adminDb();
    const result = await createAuthorization(db, {
      uid: ctx.uid,
      role: ctx.role,
      isSuperAdmin: ctx.isSuperAdmin,
      condominioId,
      membroData: ctx.membroData,
    }, {
      accessType: body?.accessType,
      nome: body?.nome,
      telefone: body?.telefone,
      placa: body?.placa,
      observacao: body?.observacao,
      visitDate: body?.visitDate,
      expectedEntryAt: body?.expectedEntryAt,
      expectedExitAt: body?.expectedExitAt,
      unitId: body?.unitId,
      blocoId: body?.blocoId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    if (e instanceof Response) return e;
    if (e instanceof AccessApiError) return NextResponse.json({ ok: e.httpStatus < 400, error: e.message, code: e.code }, { status: e.httpStatus });
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["MORADOR", "ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "SUPER_ADMIN"],
    });

    const db = adminDb();
    const scope = url.searchParams.get("scope") as "active" | "upcoming" | "history" | null;
    const limitParam = url.searchParams.get("limit");
    const result = await listOwnAuthorizations(db, {
      uid: ctx.uid,
      role: ctx.role,
      isSuperAdmin: ctx.isSuperAdmin,
      condominioId,
      membroData: ctx.membroData,
    }, {
      scope: scope || undefined,
      limit: limitParam ? Number(limitParam) : undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    if (e instanceof Response) return e;
    if (e instanceof AccessApiError) return NextResponse.json({ ok: e.httpStatus < 400, error: e.message, code: e.code }, { status: e.httpStatus });
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
