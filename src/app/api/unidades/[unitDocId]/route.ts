/**
 * UN.3 — API de Unidade individual
 *
 * PUT    /api/unidades/[unitDocId] → editar
 * DELETE /api/unidades/[unitDocId] → desativar
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { normUnidade } from "@/lib/normalization/location";
import type { UnidadeTipo } from "@/lib/normalization/unit-types";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

const VALID_TIPOS: UnidadeTipo[] = ["APARTAMENTO", "CASA", "SALA", "LOJA", "LOTE", "CONJUNTO", "OUTRO"];

export async function PUT(
  req: Request,
  ctx: { params: { unitDocId: string } }
) {
  try {
    const { unitDocId } = ctx.params;
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    const blocoId = String(body.blocoId || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!blocoId) return jsonError("blocoId é obrigatório", 400);

    const auth = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"],
    });

    const db = adminDb();
    const unidadeRef = db.collection("condominios").doc(condominioId)
      .collection("blocos").doc(blocoId).collection("unidades").doc(unitDocId);
    const unidadeSnap = await unidadeRef.get();
    if (!unidadeSnap.exists) return jsonError("Unidade não encontrada", 404);

    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };

    if (body.numero !== undefined) {
      const numero = String(body.numero).trim();
      if (!numero) return jsonError("numero não pode ser vazio", 400);
      const numeroNorm = normUnidade(numero);

      const dupeSnap = await db.collection("condominios").doc(condominioId)
        .collection("blocos").doc(blocoId).collection("unidades")
        .where("numeroNorm", "==", numeroNorm).where("ativo", "==", true).limit(2).get();
      const dupe = dupeSnap.docs.filter(d => d.id !== unitDocId);
      if (dupe.length > 0) return jsonError("Já existe unidade ativa com este número neste bloco.", 409);

      patch.numero = numero;
      patch.numeroNorm = numeroNorm;
    }

    if (body.andar !== undefined) patch.andar = body.andar !== null ? Number(body.andar) : null;

    if (body.tipo !== undefined) {
      const tipo = String(body.tipo).toUpperCase() as UnidadeTipo;
      if (!VALID_TIPOS.includes(tipo)) return jsonError("tipo inválido", 400);
      patch.tipo = tipo;
      if (tipo === "OUTRO") {
        if (!body.tipoCustom || !String(body.tipoCustom).trim()) return jsonError("tipoCustom obrigatório quando tipo é OUTRO", 400);
        patch.tipoCustom = String(body.tipoCustom).trim();
      } else {
        patch.tipoCustom = null;
      }
    }

    if (body.ocupacao !== undefined) {
      const o = String(body.ocupacao).toUpperCase();
      if (!["VAGO", "OCUPADO", "EM_REFORMA", "INTERDITADO"].includes(o)) return jsonError("ocupacao inválida", 400);
      patch.ocupacao = o;
    }

    if (body.ativo !== undefined) patch.ativo = body.ativo === true;

    await unidadeRef.update(patch);
    return NextResponse.json({ ok: true, unitDocId });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: { unitDocId: string } }
) {
  try {
    const { unitDocId } = ctx.params;
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    const blocoId = url.searchParams.get("blocoId") || "";

    if (!condominioId || !blocoId) return jsonError("condominioId e blocoId são obrigatórios", 400);

    const auth = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"],
    });

    const db = adminDb();
    const unidadeRef = db.collection("condominios").doc(condominioId)
      .collection("blocos").doc(blocoId).collection("unidades").doc(unitDocId);
    const unidadeSnap = await unidadeRef.get();
    if (!unidadeSnap.exists) return jsonError("Unidade não encontrada", 404);

    await unidadeRef.update({ ativo: false, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true, unitDocId, desativado: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
