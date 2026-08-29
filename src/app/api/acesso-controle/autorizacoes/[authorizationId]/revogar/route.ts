/**
 * ACCESS.4 — POST revoga uma autorização de acesso.
 * Porteiro/Segurança nunca podem revogar (§2/§27) — recusado dentro do serviço.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { AccessApiError } from "@/lib/access/apiErrors";
import { revokeAuthorization } from "@/lib/access/authorizationService";

export async function POST(req: Request, ctx: { params: { authorizationId: string } }) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const condominioId = String(body?.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const guard = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["MORADOR", "ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "SUPER_ADMIN"],
    });

    const db = adminDb();
    const result = await revokeAuthorization(db, {
      uid: guard.uid,
      role: guard.role,
      isSuperAdmin: guard.isSuperAdmin,
      condominioId,
      membroData: guard.membroData,
    }, ctx.params.authorizationId, typeof body?.reason === "string" ? body.reason : null);

    return NextResponse.json({ ok: true, alreadyRevoked: result.alreadyRevoked });
  } catch (e: any) {
    if (e instanceof Response) return e;
    if (e instanceof AccessApiError) return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.httpStatus });
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
