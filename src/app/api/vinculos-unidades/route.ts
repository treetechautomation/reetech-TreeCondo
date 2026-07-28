/**
 * UN.5 — API de Vínculos Pessoa ↔ Unidade
 *
 * GET  /api/vinculos-unidades?condominioId=...&pessoaId=... → listar por pessoa
 * GET  /api/vinculos-unidades?condominioId=...&unitDocId=...&blocoId=... → listar por unidade
 * POST /api/vinculos-unidades → criar vínculo
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    const pessoaId = url.searchParams.get("pessoaId") || "";
    const unitDocId = url.searchParams.get("unitDocId") || "";
    const blocoId = url.searchParams.get("blocoId") || "";

    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const auth = await checkAdminAuth(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);

    const db = adminDb();
    let query: FirebaseFirestore.Query = db.collection("condominios").doc(condominioId).collection("vinculosUnidades");

    if (pessoaId) query = query.where("pessoaId", "==", pessoaId);
    if (unitDocId && blocoId) query = query.where("unitDocId", "==", unitDocId).where("blocoId", "==", blocoId);

    const snap = await query.get();
    const vinculos = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

    return NextResponse.json({ ok: true, vinculos });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    const pessoaId = String(body.pessoaId || "").trim();
    const blocoId = String(body.blocoId || "").trim();
    const unitDocId = String(body.unitDocId || "").trim();
    const tiposVinculo: TipoVinculo[] = Array.isArray(body.tiposVinculo) ? body.tiposVinculo : [];
    const resideNaUnidade = body.resideNaUnidade === true;
    const responsavelFinanceiro = body.responsavelFinanceiro === true;
    const principal = body.principal === true;

    if (!condominioId || !pessoaId || !blocoId || !unitDocId) return jsonError("condominioId, pessoaId, blocoId e unitDocId obrigatórios", 400);
    if (tiposVinculo.length === 0) return jsonError("tiposVinculo obrigatório", 400);
    for (const t of tiposVinculo) { if (!VALID_TIPOS.includes(t)) return jsonError(`Tipo inválido: ${t}`, 400); }
    if (new Set(tiposVinculo).size !== tiposVinculo.length) return jsonError("tiposVinculo contém duplicatas", 400);
    if (principal && !resideNaUnidade) return jsonError("Unidade principal exige resideNaUnidade=true", 400);

    const auth = await checkAdminAuth(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);

    const db = adminDb();

    const condoSnap = await db.collection("condominios").doc(condominioId).get();
    if (!condoSnap.exists) return jsonError("Condomínio não encontrado", 404);

    const pessoaSnap = await db.collection("condominios").doc(condominioId).collection("pessoas").doc(pessoaId).get();
    if (!pessoaSnap.exists) return jsonError("Pessoa não encontrada", 404);

    const blocoSnap = await db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId).get();
    if (!blocoSnap.exists) return jsonError("Bloco não encontrado", 404);
    if ((blocoSnap.data() || {}).ativo === false) return jsonError("Bloco desativado", 400);

    const unidadeRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId).collection("unidades").doc(unitDocId);
    const unidadeSnap = await unidadeRef.get();
    if (!unidadeSnap.exists) return jsonError("Unidade não encontrada", 404);
    if ((unidadeSnap.data() || {}).ativo === false) return jsonError("Unidade desativada", 400);

    // Check duplicate active vinculo
    const dupeSnap = await db.collection("condominios").doc(condominioId).collection("vinculosUnidades")
      .where("pessoaId", "==", pessoaId).where("unitDocId", "==", unitDocId).where("blocoId", "==", blocoId)
      .where("status", "==", "ATIVO").limit(1).get();
    if (!dupeSnap.empty) return jsonError("Já existe vínculo ativo desta pessoa nesta unidade.", 409);

    // Transaction: create + handle principal
    const vinculoRef = db.collection("condominios").doc(condominioId).collection("vinculosUnidades").doc();

    await db.runTransaction(async (tx) => {
      const data: Record<string, any> = {
        condominioId, pessoaId, blocoId, unitDocId,
        tiposVinculo, resideNaUnidade, responsavelFinanceiro,
        principal, status: "ATIVO",
        inicioVinculo: FieldValue.serverTimestamp(),
        fimVinculo: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      // H1: exactly 1 principal per pessoa
      if (principal && resideNaUnidade) {
        const existingPrincipal = await tx.get(
          db.collection("condominios").doc(condominioId).collection("vinculosUnidades")
            .where("pessoaId", "==", pessoaId).where("principal", "==", true).where("status", "==", "ATIVO").limit(1)
        );
        if (!existingPrincipal.empty) {
          tx.update(existingPrincipal.docs[0].ref, { principal: false, updatedAt: FieldValue.serverTimestamp() });
        }
      }

      tx.set(vinculoRef, data);
    });

    return NextResponse.json({ ok: true, vinculoId: vinculoRef.id, pessoaId, unitDocId, tiposVinculo, principal, resideNaUnidade });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
