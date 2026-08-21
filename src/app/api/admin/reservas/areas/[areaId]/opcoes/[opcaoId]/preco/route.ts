/**
 * FASE 16.16 / R5 — PATCH /api/admin/reservas/areas/[areaId]/opcoes/[opcaoId]/preco
 *
 * Altera preço de uma opção. Somente gestores.
 * Preserva todos os outros campos da opção (resourceIds, nome, id, etc.)
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ALLOWED_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function PATCH(req: Request, { params }: any) {
  const areaId = String(params?.areaId ?? "").trim();
  const opcaoId = String(params?.opcaoId ?? "").trim();
  if (!areaId || !opcaoId) return jsonError("areaId e opcaoId são obrigatórios.", 400);

  try {
    let body: any;
    try { body = await req.json(); } catch { return jsonError("Body inválido.", 400); }

    const condominioId = String(body?.condominioId ?? "").trim();
    const precoCentavos = Number(body?.precoCentavos);

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!Number.isFinite(precoCentavos) || !Number.isInteger(precoCentavos) || precoCentavos < 0) {
      return jsonError("precoCentavos deve ser um inteiro não negativo.", 400);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ALLOWED_ROLES,
    });

    const db = adminDb();

    const areaRef = db.collection("condominios").doc(condominioId).collection("areasReservaveis").doc(areaId);
    const areaSnap = await areaRef.get();
    if (!areaSnap.exists) return jsonError("Área não encontrada.", 404);

    const area = areaSnap.data()!;
    const ops = Array.isArray(area.opcoes) ? area.opcoes : [];
    const idx = ops.findIndex((o: any) => String(o.id) === opcaoId);
    if (idx < 0) return jsonError("Opção não encontrada nesta área.", 404);

    const opcao = ops[idx];
    const valorAnterior = Number(opcao.precoCentavos ?? opcao.preco ?? 0);

    const updatedOps = [...ops];
    updatedOps[idx] = { ...updatedOps[idx], precoCentavos, preco: precoCentavos };

    const ts = FieldValue.serverTimestamp();
    const historicoRef = areaRef.collection("historicoPrecos").doc();

    await db.runTransaction(async (tx: any) => {
      tx.update(areaRef, { opcoes: updatedOps, updatedAt: ts });
      tx.set(historicoRef, {
        areaId,
        opcaoId,
        valorAnteriorCentavos: valorAnterior,
        valorNovoCentavos: precoCentavos,
        alteradoPorUid: ctx.uid,
        alteradoEm: ts,
      });
    });

    return NextResponse.json({ ok: true, precoCentavos });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
