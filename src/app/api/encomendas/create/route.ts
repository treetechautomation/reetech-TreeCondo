import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { createHash, randomBytes } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

function randomCode(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);
    const body = (await req.json().catch(() => ({}))) as any;
    console.log("[DIAGNÓSTICO] API /api/encomendas/create - body recebido:", body);


    const condominioId = String(body?.condominioId || "").trim();

    // Aceita os nomes do seu front (unidadeId/blocoId/observacao)
    const unidadeId = String(body?.unidadeId || body?.unidade || "").trim();
    const blocoId = body?.blocoId ? String(body.blocoId).trim() : (body?.bloco ? String(body.bloco).trim() : "");
    const transportadora = String(body?.transportadora || "").trim();
    const observacao = body?.observacao ? String(body.observacao).trim() : "";
    const pinInput = body?.pin ? String(body.pin).trim() : "";

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!unidadeId) return jsonError("Informe a unidade.", 400);
    if (!transportadora) return jsonError("Informe a transportadora.", 400);

    // QR por texto (MODELO 1)
    const codigo = `PKG-${randomCode(8)}`;
    const pin = pinInput || codigo.slice(-4);

    const encomendaRef = db.collection("condominios").doc(condominioId).collection("encomendas").doc();
    const encomendaId = encomendaRef.id;

    // Notificação interna (MODELO 1)
    const notifRef = db.collection("condominios").doc(condominioId).collection("notificacoes").doc();

    await db.runTransaction(async (tx) => {
      tx.set(encomendaRef, {
        condominioId,
        status: "AGUARDANDO",

        unidadeId,
        blocoId: blocoId || null,
        transportadora,
        observacoes: observacao || null,

        chegouEm: FieldValue.serverTimestamp(),

        // validação futura na retirada
        codigoRetiradaHash: sha256(codigo),
        codigoRetiradaLast4: codigo.slice(-4),

        pinHash: sha256(pin),
        pinLast4: pin.slice(-4),

        retiradaEm: null,
        retiradoPorUid: null,
        retiradoPorNome: null,
        retiradoPorDocumento: null,
        retiradoPorTelefone: null,
        retiradoPorTipo: null,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        criadoPorUid: decoded.uid,
        criadoPorEmail: (decoded.email || "").toLowerCase(),
      });

      tx.set(notifRef, {
        // se você já tiver moradorUid pela unidade, depois a gente preenche targetUid.
        targetUid: null,

        tipo: "ENCOMENDA_CHEGOU",
        titulo: "📦 Encomenda recebida",
        mensagem: `Chegou uma encomenda para ${blocoId ? `Bloco ${blocoId} • ` : ""}Unidade ${unidadeId}.`,
        encomendaId,
        condominioId,

        lida: false,
        lidaEm: null,
        arquivada: false,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdByUid: decoded.uid,
      });
    });

    console.log("[DIAGNÓSTICO] API /api/encomendas/create - sucesso:", { ok: true, encomendaId, codigo, pin });
    return NextResponse.json({
      ok: true,
      encomendaId,
      codigo,
      pin,
    });
  } catch (err: any) {
    console.error("[DIAGNÓSTICO] Erro na API /api/encomendas/create:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
