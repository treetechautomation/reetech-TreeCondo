/**
 * UN.4A — API de geração em lote de unidades
 *
 * POST /api/unidades/batch
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { normUnidade } from "@/lib/normalization/location";
import type { UnidadeTipo } from "@/lib/normalization/unit-types";

const VALID_TIPOS: UnidadeTipo[] = ["APARTAMENTO", "CASA", "SALA", "LOJA", "LOTE", "CONJUNTO", "OUTRO"];
const MAX_BATCH = 200; // Firestore batch write limit is 500; conservative limit for request size + memory

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
  if (!["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"].includes(String(vd.role || "").toUpperCase()))
    return { ok: false, error: "Sem permissão.", status: 403 };
  return { ok: true, uid };
}

interface BatchUnidadeInput {
  numero: string;
  andar?: number | null;
  tipo: UnidadeTipo;
  tipoCustom?: string | null;
  ocupacao: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    const blocoId = String(body.blocoId || "").trim();
    const unidadesInput: BatchUnidadeInput[] = body.unidades || [];
    const tipo = String(body.tipo || "APARTAMENTO").toUpperCase() as UnidadeTipo;
    const tipoCustom: string | null = body.tipoCustom ? String(body.tipoCustom).trim() : null;
    const ocupacao = String(body.ocupacao || "VAGO").toUpperCase();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!blocoId) return jsonError("blocoId é obrigatório", 400);
    if (!Array.isArray(unidadesInput) || unidadesInput.length === 0) return jsonError("unidades é obrigatório", 400);
    if (unidadesInput.length > MAX_BATCH) return jsonError(`Limite de ${MAX_BATCH} unidades por lote.`, 400);
    if (!VALID_TIPOS.includes(tipo)) return jsonError("tipo inválido", 400);
    if (tipo === "OUTRO" && !tipoCustom) return jsonError("tipoCustom obrigatório quando tipo é OUTRO", 400);
    if (!["VAGO", "OCUPADO", "EM_REFORMA", "INTERDITADO"].includes(ocupacao)) return jsonError("ocupacao inválida", 400);

    const auth = await checkAdminAuth(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);

    const db = adminDb();

    const condoSnap = await db.collection("condominios").doc(condominioId).get();
    if (!condoSnap.exists) return jsonError("Condomínio não encontrado", 404);

    const blocoSnap = await db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId).get();
    if (!blocoSnap.exists) return jsonError("Bloco não encontrado", 404);
    if ((blocoSnap.data() || {}).ativo === false) return jsonError("Bloco está desativado", 400);

    // Build normalized unidades list + detect internal duplicates
    const normSet = new Set<string>();
    const existingNumeroNorms = new Set<string>();
    const results: { numero: string; unitDocId: string | null; status: string; error?: string }[] = [];

    // Phase 1: check for internal duplicates and normalize
    const normalizedInput: { numero: string; numeroNorm: string; andar: number | null }[] = [];
    for (const u of unidadesInput) {
      const numero = String(u.numero || "").trim();
      if (!numero) { results.push({ numero: "", unitDocId: null, status: "INVÁLIDO", error: "Número vazio" }); continue; }
      const numeroNorm = normUnidade(numero);
      if (normSet.has(numeroNorm)) {
        results.push({ numero, unitDocId: null, status: "DUPLICADO_LOTE", error: `"${numero}" duplicado no lote (normalizado: "${numeroNorm}")` });
        continue;
      }
      normSet.add(numeroNorm);
      normalizedInput.push({ numero, numeroNorm, andar: u.andar ?? null });
    }

    const dups = results.filter(r => r.status !== "NOVA");
    if (dups.length > 0) {
      return jsonError("Existem unidades inválidas ou duplicadas no lote.", 400);
    }

    // Phase 2: check conflicts with existing units
    const existingSnap = await db.collection("condominios").doc(condominioId)
      .collection("blocos").doc(blocoId).collection("unidades")
      .where("ativo", "==", true).get();

    for (const doc of existingSnap.docs) {
      const d = doc.data() || {};
      if (d.numeroNorm) existingNumeroNorms.add(String(d.numeroNorm));
    }

    const conflicts = normalizedInput.filter(u => existingNumeroNorms.has(u.numeroNorm));
    if (conflicts.length > 0) {
      return NextResponse.json({
        ok: false,
        error: `${conflicts.length} unidade(s) já existem neste bloco.`,
        conflitos: conflicts.map(c => c.numero),
      }, { status: 409 });
    }

    // Phase 3: batch create
    const batch = db.batch();
    const created: { numero: string; unitDocId: string }[] = [];

    for (const u of normalizedInput) {
      const ref = db.collection("condominios").doc(condominioId)
        .collection("blocos").doc(blocoId).collection("unidades").doc();
      const data: Record<string, any> = {
        numero: u.numero,
        numeroNorm: u.numeroNorm,
        blocoId,
        condominioId,
        andar: u.andar,
        tipo,
        tipoCustom: tipoCustom || null,
        ocupacao,
        ativo: true,
        proprietarioUid: null,
        inquilinoUid: null,
        responsavelUid: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      batch.set(ref, data);
      created.push({ numero: u.numero, unitDocId: ref.id });
    }

    await batch.commit();

    return NextResponse.json({
      ok: true,
      criadas: created.length,
      unidades: created,
      blocoId,
      condominioId,
    });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
