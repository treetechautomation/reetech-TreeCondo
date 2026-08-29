/**
 * ACCESS.4 — GET detalhe de uma autorização de acesso.
 * Porteiro/Segurança não precisam desta rota (§25) — não estão em allowedRoles.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { AccessApiError } from "@/lib/access/apiErrors";
import { getAuthorizationDetail } from "@/lib/access/authorizationService";

export async function GET(req: Request, ctx: { params: { authorizationId: string } }) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const guard = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["MORADOR", "ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "SUPER_ADMIN"],
    });

    const db = adminDb();
    const authorization = await getAuthorizationDetail(db, {
      uid: guard.uid,
      role: guard.role,
      isSuperAdmin: guard.isSuperAdmin,
      condominioId,
      membroData: guard.membroData,
    }, ctx.params.authorizationId);

    return NextResponse.json({ ok: true, authorization });
  } catch (e: any) {
    if (e instanceof Response) return e;
    if (e instanceof AccessApiError) return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.httpStatus });
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
