/**
 * UN.5 — API de Vínculo individual
 *
 * PUT    /api/vinculos-unidades/[vinculoId] → editar (tipos, principal, reside, etc.)
 * DELETE /api/vinculos-unidades/[vinculoId] → inativar (soft-delete)
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const VALID_TIPOS = ["PROPRIETARIO", "INQUILINO", "MORADOR", "DEPENDENTE", "RESPONSAVEL"] as const;
type TipoVinculo = typeof VALID_TIPOS[number];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function checkAdminAuth(req: Request, condominioId: string) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, error: "Token ausente.", status: 401 };
  let decoded: any;
  try { decoded = await adminAuth().verifyIdToken(token); }
  catch { return { ok: false, error: "Token inválido.", status: 401 }; }
  const uid = decoded.uid;
  const isSuper = decoded.super_admin === true || (decoded as any).superAdmin === true;
  if (isSuper) return { ok: true, uid, isSuper: true };
  const db = adminDb();
  const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId).get();
  if (!vincSnap.exists) return { ok: false, error: "Sem vínculo.", status: 403 };
  const vd = vincSnap.data() || {};
  if (String(vd.status || "").toUpperCase() !== "ATIVO") return { ok: false, error: "Vínculo inativo.", status: 403 };
  const role = String(vd.role || "").toUpperCase();
  if (!["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"].includes(role))
    return { ok: false, error: "Sem permissão.", status: 403 };
  return { ok: true, uid, isSuper: false };
}

export async function PUT(
  req: Request,
  ctx: { params: { vinculoId: string } }
) {
  try {
    const { vinculoId } = ctx.params;
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const auth = await checkAdminAuth(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);

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

    // H1: principal handling within transaction
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(vinculoRef);
      if (!snap.exists) throw new Error("Vínculo não encontrado");
      const curr = snap.data() || {};
      const newPrincipal = body.principal === true;
      const newReside = body.resideNaUnidade !== undefined ? body.resideNaUnidade === true : curr.resideNaUnidade;
      const pessoaId = curr.pessoaId;

      if (newPrincipal) {
        if (!newReside) throw new Error("Unidade principal exige resideNaUnidade=true");
        // Demote current principal
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

    const auth = await checkAdminAuth(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);

    const db = adminDb();
    const vinculoRef = db.collection("condominios").doc(condominioId).collection("vinculosUnidades").doc(vinculoId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(vinculoRef);
      if (!snap.exists) throw new Error("Vínculo não encontrado");
      const curr = snap.data() || {};

      if (curr.principal) {
        // Must have another active reside-based vinculo to take over principal
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
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
