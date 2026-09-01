/**
 * ACCESS.5B — GET contexto de autorização do morador.
 *
 * Read-only. Responde "quais unidades este morador autenticado pode
 * usar para autorizar um acesso" usando a MESMA primitive de
 * elegibilidade que o CREATE (`resolveEligibleUnits`, via
 * `listEligibleUnitsWithLabels`) — nenhuma lógica paralela de
 * descoberta de unidade.
 *
 * Restrito a MORADOR: PORTEIRO/SEGURANCA não têm motivo para descobrir
 * as unidades de um morador por esta rota (não é o fluxo de resolve
 * futuro); atores administrativos informam unitId/blocoId diretamente
 * no CREATE e não precisam deste endpoint de descoberta.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { listEligibleUnitsWithLabels } from "@/lib/access/unitResolution";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["MORADOR"],
    });

    const db = adminDb();
    const units = await listEligibleUnitsWithLabels(db, condominioId, ctx.uid, ctx.membroData);

    return NextResponse.json({
      ok: true,
      units,
      selectionRequired: units.length > 1,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
