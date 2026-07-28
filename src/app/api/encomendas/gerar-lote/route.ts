import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { randomBytes } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { normUnidade, normBloco } from "@/lib/normalization/location";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}



export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();
  const correlationId = extractCorrelationId(req);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body?.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId é obrigatório", 400);

    // Busca dados do morador para identificar a unidade
    const mref = db.collection("condominios").doc(condominioId).collection("membros").doc(decoded.uid);
    const msnap = await mref.get();
    if (!msnap.exists) {
      return jsonError("Vínculo de morador não encontrado neste condomínio.", 404);
    }

    const md = msnap.data() || {};
    const status = String(md.status || "").toUpperCase();
    if (status !== "ATIVO") {
      return jsonError("Seu cadastro de morador precisa estar ativo para gerar QR de retirada.", 403);
    }

    let targetUnidadeNorm = normUnidade(md.unidadeId || md.apartamento);
    let targetBlocoNorm = (md.blocoId || md.bloco) ? normBloco(md.blocoId || md.bloco) : null;
    
    if (!targetUnidadeNorm) {
      return jsonError("Unidade do morador não cadastrada.", 400);
    }

    // Busca todas as encomendas da unidade que estão AGUARDANDO
    const encomendasRef = db.collection("condominios").doc(condominioId).collection("encomendas");
    let q = encomendasRef
      .where("unidadeIdNorm", "==", targetUnidadeNorm)
      .where("status", "==", "AGUARDANDO");

    if (targetBlocoNorm) {
      q = q.where("blocoIdNorm", "==", targetBlocoNorm);
    }

    const snap = await q.get();
    
    // Filtro adicional de segurança para bloco nulo/vazio
    const pendingDocs = snap.docs.filter((d: any) => {
      const pData = d.data() || {};
      if (targetBlocoNorm) {
        return pData.blocoIdNorm === targetBlocoNorm;
      } else {
        return !pData.blocoIdNorm;
      }
    });

    // Exige pelo menos 2 encomendas para gerar retirada em lote
    if (pendingDocs.length < 2) {
      return jsonError("É necessário ter pelo menos 2 encomendas aguardando para gerar retirada em lote.", 400);
    }

    const encomendaIds = pendingDocs.map((d: any) => d.id);

    // Gera o token de lote (comprimento 6 como solicitado: LOTE-XXXXXX)
    const batchToken = `LOTE-${randomCode(6)}`;
    
    // Salva na subcoleção retiradas_lote
    const loteRef = db.collection("condominios").doc(condominioId).collection("retiradas_lote").doc(batchToken);
    const criadoEm = new Date();
    const expiraEm = new Date(criadoEm.getTime() + 2 * 60 * 60 * 1000); // Validade de 2 horas

    await loteRef.set({
      token: batchToken,
      unidadeId: md.unidadeId || md.apartamento || "",
      blocoId: md.blocoId || md.bloco || null,
      moradorUid: decoded.uid,
      encomendaIds,
      status: "PENDENTE",
      criadoEm: FieldValue.serverTimestamp(),
      expiraEm: expiraEm,
      utilizadoEm: null,
      utilizadoPorUid: null,
      utilizadoPorNome: null,
    });

    const encomendasRetornadas = pendingDocs.map((d: any) => {
      const data = d.data();
      return {
        id: d.id,
        transportadora: data.transportadora || "",
        codigo: data.codigo || "",
      };
    });

    logEncomendaEvent({
      event: "PACKAGE_QR_ISSUED",
      timestamp: new Date().toISOString(),
      operation: "gerar-lote",
      result: "success",
      condominioId,
      actorUid: decoded.uid,
      actorRole: "MORADOR",
      method: "LOTE",
      correlationId,
    });

    return NextResponse.json({
      ok: true,
      token: batchToken,
      expiraEm: expiraEm.toISOString(),
      encomendas: encomendasRetornadas,
      quantidade: encomendaIds.length,
    });

  } catch (err: any) {
    logEncomendaEvent({
      event: "PACKAGE_CREATE_FAILED",
      timestamp: new Date().toISOString(),
      operation: "gerar-lote",
      result: "error",
      condominioId: null,
      errorCode: String(500),
      errorMessage: err?.message || "Erro inesperado no servidor",
      correlationId,
    });
    return jsonError(err?.message || "Erro inesperado no servidor", 500);
  }
}
