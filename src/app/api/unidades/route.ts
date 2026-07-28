/**
 * UN.3 — API de Unidades
 *
 * GET  /api/unidades?condominioId=...&blocoId=... → listar
 * POST /api/unidades → criar
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { normUnidade } from "@/lib/normalization/location";
import type { UnidadeTipo } from "@/lib/normalization/unit-types";

const VALID_TIPOS: UnidadeTipo[] = ["APARTAMENTO", "CASA", "SALA", "LOJA", "LOTE", "CONJUNTO", "OUTRO"];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function checkAdminAuth(req: Request, condominioId: string) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, error: "Token ausente.", status: 401 };

  let decoded: any;
  try { decoded = await adminAuth().verifyIdToken(token); }
  catch { return { ok: false, error: "Token inválido ou expirado.", status: 401 }; }

  const uid = decoded.uid;
  const isSuper = decoded.super_admin === true || (decoded as any).superAdmin === true;
  if (isSuper) return { ok: true, uid };

  const db = adminDb();
  const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId).get();
  if (!vincSnap.exists) return { ok: false, error: "Sem vínculo.", status: 403 };
  const vd = vincSnap.data() || {};
  if (String(vd.status || "").toUpperCase() !== "ATIVO") return { ok: false, error: "Vínculo inativo.", status: 403 };
  const role = String(vd.role || "").toUpperCase();
  if (!["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"].includes(role)) return { ok: false, error: "Sem permissão.", status: 403 };
  return { ok: true, uid };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    const blocoId = url.searchParams.get("blocoId") || "";
    const busca = url.searchParams.get("busca") || "";
    const tipo = url.searchParams.get("tipo") || "";
    const apenasAtivas = url.searchParams.get("apenasAtivas") === "true";

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!blocoId) return jsonError("blocoId é obrigatório", 400);

    const db = adminDb();
    const blocoSnap = await db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId).get();
    if (!blocoSnap.exists) return jsonError("Bloco não encontrado", 404);

    let query: FirebaseFirestore.Query = db.collection("condominios").doc(condominioId)
      .collection("blocos").doc(blocoId).collection("unidades");

    if (apenasAtivas) query = query.where("ativo", "==", true);
    if (tipo && VALID_TIPOS.includes(tipo as UnidadeTipo)) query = query.where("tipo", "==", tipo);

    const snap = await query.get();

    let unidades = snap.docs.map(d => {
      const data = d.data() || {};
      return {
        id: d.id,
        numero: data.numero || "",
        numeroNorm: data.numeroNorm || "",
        blocoId,
        condominioId,
        andar: data.andar ?? null,
        tipo: data.tipo || "APARTAMENTO",
        tipoCustom: data.tipoCustom || null,
        ocupacao: data.ocupacao || "VAGO",
        ativo: data.ativo !== false,
        proprietarioUid: data.proprietarioUid || null,
        inquilinoUid: data.inquilinoUid || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
      };
    });

    if (busca) {
      const q = normUnidade(busca);
      unidades = unidades.filter((u: any) => u.numeroNorm.includes(q) || u.numero.toLowerCase().includes(busca.toLowerCase()));
    }

    unidades.sort((a: any, b: any) => {
      const na = parseInt(a.numeroNorm, 10);
      const nb = parseInt(b.numeroNorm, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a.numero).localeCompare(String(b.numero));
    });

    return NextResponse.json({ ok: true, unidades });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    const blocoId = String(body.blocoId || "").trim();
    const numero = String(body.numero || "").trim();
    const andar = body.andar !== undefined && body.andar !== null ? Number(body.andar) : null;
    const tipo = String(body.tipo || "APARTAMENTO").toUpperCase() as UnidadeTipo;
    const tipoCustom = body.tipoCustom ? String(body.tipoCustom).trim() : null;

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!blocoId) return jsonError("blocoId é obrigatório", 400);
    if (!numero) return jsonError("numero é obrigatório", 400);
    if (!VALID_TIPOS.includes(tipo)) return jsonError(`tipo inválido`, 400);
    if (tipo === "OUTRO" && !tipoCustom) return jsonError("tipoCustom é obrigatório quando tipo é OUTRO", 400);

    const auth = await checkAdminAuth(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);

    const db = adminDb();
    const condoSnap = await db.collection("condominios").doc(condominioId).get();
    if (!condoSnap.exists) return jsonError("Condomínio não encontrado", 404);

    const blocoSnap = await db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId).get();
    if (!blocoSnap.exists) return jsonError("Bloco não encontrado", 404);
    const bd = blocoSnap.data() || {};
    if (bd.ativo === false) return jsonError("Bloco está desativado", 400);

    const numeroNorm = normUnidade(numero);

    const dupeSnap = await db.collection("condominios").doc(condominioId)
      .collection("blocos").doc(blocoId).collection("unidades")
      .where("numeroNorm", "==", numeroNorm).where("ativo", "==", true).limit(1).get();
    if (!dupeSnap.empty) return jsonError("Já existe uma unidade ativa com este número neste bloco.", 409);

    const unidadeRef = db.collection("condominios").doc(condominioId)
      .collection("blocos").doc(blocoId).collection("unidades").doc();

    const unidadeData: Record<string, any> = {
      numero, numeroNorm,
      blocoId, condominioId,
      andar,
      tipo, tipoCustom: tipoCustom || null,
      ocupacao: "VAGO",
      ativo: true,
      proprietarioUid: null,
      inquilinoUid: null,
      responsavelUid: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await unidadeRef.set(unidadeData);
    return NextResponse.json({ ok: true, unitDocId: unidadeRef.id, numero, tipo, blocoId });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
