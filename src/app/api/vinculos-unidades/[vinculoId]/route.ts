/**
 * UN.5 — API de Vínculo individual
 *
 * PUT    /api/vinculos-unidades/[vinculoId] → editar (tipos, principal, reside, etc.)
 * DELETE /api/vinculos-unidades/[vinculoId] → inativar (soft-delete)
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ADMIN_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

const VALID_TIPOS = ["PROPRIETARIO", "INQUILINO", "MORADOR", "DEPENDENTE", "RESPONSAVEL"] as const;
type TipoVinculo = typeof VALID_TIPOS[number];

export async function PUT(
  req: Request,
  ctx: { params: { vinculoId: string } }
) {
  try {
    const { vinculoId } = ctx.params;
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const auth = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ADMIN_ROLES,
    });

    const db = adminDb();
    const vinculoRef = db.collection("condominios").doc(condominioId).collection("vinculosUnidades").doc(vinculoId);
    const vinculoSnap = await vinculoRef.get();
    if (!vinculoSnap.exists) return jsonError("Vínculo não encontrado", 404);

    const current = vinculoSnap.data() || {};
    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };

    if (body.tiposVinculo !== undefined) {
      const tipos: TipoVinculo[] = Array.isArray(body.tiposVinculo) ? body.tiposVinculo : [];
      if (tipos.length === 0) return jsonError("tiposVinculo não pode ser vazio", 400);
      for (const t of tipos) { if (!VALID_TIPOS.includes(t)) return jsonError(`Tipo inválido: ${t}`, 400); }
      if (new Set(tipos).size !== tipos.length) return jsonError("tiposVinculo com duplicatas", 400);
      patch.tiposVinculo = tipos;
    }

    if (body.resideNaUnidade !== undefined) patch.resideNaUnidade = body.resideNaUnidade === true;
    if (body.responsavelFinanceiro !== undefined) patch.responsavelFinanceiro = body.responsavelFinanceiro === true;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(vinculoRef);
      if (!snap.exists) throw new Error("Vínculo não encontrado");
      const curr = snap.data() || {};
      const newPrincipal = body.principal === true;
      const newReside = body.resideNaUnidade !== undefined ? body.resideNaUnidade === true : curr.resideNaUnidade;
      const pessoaId = curr.pessoaId;

      if (newPrincipal) {
        if (!newReside) throw new Error("Unidade principal exige resideNaUnidade=true");
        const existingPrincipal = await tx.get(
          db.collection("condominios").doc(condominioId).collection("vinculosUnidades")
            .where("pessoaId", "==", pessoaId).where("principal", "==", true).where("status", "==", "ATIVO").limit(1)
        );
        if (!existingPrincipal.empty && existingPrincipal.docs[0].id !== vinculoId) {
          tx.update(existingPrincipal.docs[0].ref, { principal: false, updatedAt: FieldValue.serverTimestamp() });
        }
        patch.principal = true;
      } else if (body.principal === false) {
        patch.principal = false;
      }

      tx.update(vinculoRef, patch);
    });

    return NextResponse.json({ ok: true, vinculoId });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: { vinculoId: string } }
) {
  try {
    const { vinculoId } = ctx.params;
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const auth = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ADMIN_ROLES,
    });

    const db = adminDb();
    const vinculoRef = db.collection("condominios").doc(condominioId).collection("vinculosUnidades").doc(vinculoId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(vinculoRef);
      if (!snap.exists) throw new Error("Vínculo não encontrado");
      const curr = snap.data() || {};

      if (curr.principal) {
        const altSnap = await tx.get(
          db.collection("condominios").doc(condominioId).collection("vinculosUnidades")
            .where("pessoaId", "==", curr.pessoaId).where("resideNaUnidade", "==", true)
            .where("status", "==", "ATIVO").limit(2)
        );
        const alts = altSnap.docs.filter(d => d.id !== vinculoId);
        if (alts.length > 0) {
          tx.update(alts[0].ref, { principal: true, updatedAt: FieldValue.serverTimestamp() });
        }
      }

      tx.update(vinculoRef, {
        status: "INATIVO",
        fimVinculo: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        principal: false,
      });
    });

    return NextResponse.json({ ok: true, vinculoId, inativado: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
