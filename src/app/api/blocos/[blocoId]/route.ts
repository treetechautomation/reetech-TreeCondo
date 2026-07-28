/**
 * UN.3 — API de Bloco individual
 *
 * PUT    /api/blocos/[blocoId] → editar
 * DELETE /api/blocos/[blocoId] → desativar
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { normBloco } from "@/lib/normalization/location";
import type { BlocoTipo } from "@/lib/normalization/unit-types";

const VALID_TIPOS: BlocoTipo[] = ["BLOCO", "TORRE", "QUADRA", "SETOR", "ALAMEDA", "OUTRO"];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function checkAdminEdit(req: Request, condominioId: string) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, error: "Token ausente.", status: 401 };

  let decoded: any;
  try { decoded = await adminAuth().verifyIdToken(token); }
  catch { return { ok: false, error: "Token inválido ou expirado.", status: 401 }; }

  const uid = decoded.uid;
  const isSuper = decoded.super_admin === true || (decoded as any).superAdmin === true;

  if (isSuper) return { ok: true, uid, isSuper: true };

  const db = adminDb();
  const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId).get();
  if (!vincSnap.exists) return { ok: false, error: "Sem vínculo com este condomínio.", status: 403 };

  const vd = vincSnap.data() || {};
  const role = String(vd.role || "").toUpperCase();
  const status = String(vd.status || "").toUpperCase();
  if (status !== "ATIVO") return { ok: false, error: "Vínculo não está ativo.", status: 403 };

  const allowed = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
  if (!allowed.includes(role)) return { ok: false, error: "Sem permissão.", status: 403 };

  return { ok: true, uid, isSuper: false, role };
}

export async function PUT(
  req: Request,
  ctx: { params: { blocoId: string } }
) {
  try {
    const { blocoId } = ctx.params;
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!blocoId) return jsonError("blocoId é obrigatório", 400);

    const auth = await checkAdminEdit(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);

    const db = adminDb();
    const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId);
    const blocoSnap = await blocoRef.get();
    if (!blocoSnap.exists) return jsonError("Bloco não encontrado", 404);

    const blocoData = blocoSnap.data() || {};
    if (blocoData.isSistema === true && !auth.isSuper) {
      return jsonError("Bloco do sistema não pode ser editado.", 403);
    }

    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };

    if (body.nome !== undefined) {
      const nome = String(body.nome).trim();
      if (!nome) return jsonError("nome não pode ser vazio", 400);
      const nomeNorm = normBloco(nome);
      const dupeSnap = await db.collection("condominios").doc(condominioId)
        .collection("blocos").where("nomeNorm", "==", nomeNorm).where("ativo", "==", true).limit(2).get();
      const dupe = dupeSnap.docs.filter(d => d.id !== blocoId);
      if (dupe.length > 0) return jsonError("Já existe um bloco ativo com este nome.", 409);
      patch.nome = nome;
      patch.nomeNorm = nomeNorm;
    }

    if (body.tipo !== undefined) {
      const tipo = String(body.tipo).toUpperCase() as BlocoTipo;
      if (!VALID_TIPOS.includes(tipo)) return jsonError(`tipo inválido`, 400);
      patch.tipo = tipo;
      if (tipo === "OUTRO") {
        if (!body.tipoCustom || !String(body.tipoCustom).trim()) return jsonError("tipoCustom é obrigatório quando tipo é OUTRO", 400);
        patch.tipoCustom = String(body.tipoCustom).trim();
      } else {
        patch.tipoCustom = null;
      }
    }

    if (body.ordem !== undefined) patch.ordem = Number(body.ordem) || 0;
    if (body.ativo !== undefined) patch.ativo = body.ativo === true;

    await blocoRef.update(patch);
    return NextResponse.json({ ok: true, blocoId });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: { blocoId: string } }
) {
  try {
    const { blocoId } = ctx.params;
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!blocoId) return jsonError("blocoId é obrigatório", 400);

    const auth = await checkAdminEdit(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);

    const db = adminDb();
    const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId);
    const blocoSnap = await blocoRef.get();
    if (!blocoSnap.exists) return jsonError("Bloco não encontrado", 404);

    const blocoData = blocoSnap.data() || {};
    if (blocoData.isSistema === true) return jsonError("Bloco do sistema não pode ser desativado.", 403);

    const activeUnidades = await db.collection("condominios").doc(condominioId)
      .collection("blocos").doc(blocoId).collection("unidades")
      .where("ativo", "==", true).limit(1).get();
    if (!activeUnidades.empty) return jsonError("Não é possível desativar bloco com unidades ativas.", 409);

    await blocoRef.update({ ativo: false, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true, blocoId, desativado: true });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
