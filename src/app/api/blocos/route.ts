/**
 * UN.3 — API de Blocos
 *
 * GET  /api/blocos?condominioId=... → listar
 * POST /api/blocos → criar
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { normBloco } from "@/lib/normalization/location";
import type { BlocoTipo } from "@/lib/normalization/unit-types";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

const VALID_TIPOS: BlocoTipo[] = ["BLOCO", "TORRE", "QUADRA", "SETOR", "ALAMEDA", "OUTRO"];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId é obrigatório", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"],
    });

    const db = adminDb();
    const snap = await db.collection("condominios").doc(condominioId).collection("blocos").get();

    const blocos = snap.docs.map(d => {
      const data = d.data() || {};
      return {
        id: d.id,
        nome: data.nome || data.blocoNome || d.id,
        nomeNorm: data.nomeNorm || data.blocoNomeNorm || "",
        tipo: data.tipo || "BLOCO",
        tipoCustom: data.tipoCustom || null,
        isSistema: data.isSistema === true,
        ordem: data.ordem ?? 0,
        ativo: data.ativo !== false,
        condominioId,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
      };
    }).sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.nome).localeCompare(String(b.nome)));

    return NextResponse.json({ ok: true, blocos });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    const nome = String(body.nome || "").trim();
    const tipo = String(body.tipo || "BLOCO").toUpperCase() as BlocoTipo;
    const tipoCustom = body.tipoCustom ? String(body.tipoCustom).trim() : null;
    const ordem = typeof body.ordem === "number" ? body.ordem : 0;

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!nome) return jsonError("nome é obrigatório", 400);
    if (!VALID_TIPOS.includes(tipo)) return jsonError(`tipo inválido. Válidos: ${VALID_TIPOS.join(", ")}`, 400);
    if (tipo === "OUTRO" && !tipoCustom) return jsonError("tipoCustom é obrigatório quando tipo é OUTRO", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"],
    });

    const db = adminDb();
    const condoSnap = await db.collection("condominios").doc(condominioId).get();
    if (!condoSnap.exists) return jsonError("Condomínio não encontrado", 404);

    const nomeNorm = normBloco(nome);

    const dupeSnap = await db.collection("condominios").doc(condominioId)
      .collection("blocos").where("nomeNorm", "==", nomeNorm).where("ativo", "==", true).limit(1).get();
    if (!dupeSnap.empty) return jsonError("Já existe um bloco ativo com este nome.", 409);

    const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc();
    const blocoData: Record<string, any> = {
      nome, nomeNorm,
      tipo, tipoCustom: tipoCustom || null,
      isSistema: false,
      ordem,
      ativo: true,
      condominioId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await blocoRef.set(blocoData);

    return NextResponse.json({ ok: true, blocoId: blocoRef.id, nome, tipo });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
