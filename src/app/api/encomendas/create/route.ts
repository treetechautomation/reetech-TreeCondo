import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { randomBytes } from "crypto";
import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { generatePin, hashPin, generateQRToken, hashQRToken, normalizeCode, createWithdrawEvent } from "@/lib/encomendas/withdrawal";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { notifyUnidade } from "@/lib/notifications/notifyUnidade";

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}

async function sendPushToUids(params: {
  db: any;
  uids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const { db, uids, title, body, data } = params;
  if (!uids?.length) return;

  const tokenDocs: Array<{ uid: string; tokenId: string; token?: string | null }> = [];
  for (const uid of uids) {
    try {
      const snap = await db.collection("users").doc(uid).collection("fcmTokens").get();
      snap.forEach((d: any) => tokenDocs.push({ uid, tokenId: d.id, ...(d.data() || {}) }));
    } catch (e: any) {
      console.warn("[FCM] falha lendo tokens do uid", uid, e?.message || String(e));
    }
  }

  const tokens = tokenDocs
    .map((t: any) => String(t.token || t.tokenId || "").trim())
    .filter(Boolean);

  if (!tokens.length) {
    console.log("[FCM] nenhum token para enviar push (uids):", uids.length);
    return;
  }

  const msg = adminMessaging();

  const resp = await msg.sendEachForMulticast({
    tokens,
    webpush: {
      headers: { Urgency: "high" },
      notification: {
        title, body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
      },
      fcmOptions: { link: "/encomendas" },
    },
    android: { priority: "high" },
    apns: { headers: { "apns-priority": "10" } },
    data: { click_action: "/encomendas", ...(data || {}) },
  });

  console.log("[FCM] push multicast result:", {
    tokens: tokens.length,
    successCount: resp.successCount,
    failureCount: resp.failureCount,
  });

  const invalid: string[] = [];
  resp.responses.forEach((r: any, i: number) => {
    if (r.success) return;
    const code = r.error?.code || "";
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      invalid.push(tokens[i]);
    }
  });

  if (invalid.length) {
    console.warn("[FCM] removendo tokens inválidos:", invalid.length);
    await Promise.all(
      invalid.map(async (tok) => {
        const td = tokenDocs.find((x: any) => (x.token || x.tokenId) === tok);
        if (!td?.uid) return;
        try {
          await db.collection("users").doc(td.uid).collection("fcmTokens").doc(tok).delete();
        } catch (e: any) {
          console.warn("[FCM] falha ao deletar token inválido", tok, e?.message || String(e));
        }
      })
    );
  }
}

export async function POST(req: Request) {
  const db = adminDb();
  const correlationId = extractCorrelationId(req);
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));

    const condominioId = String(body?.condominioId || "").trim();
    const unitDocId = body?.unitDocId ? String(body.unitDocId).trim() : null;
    const destinatarioPessoaId = body?.destinatarioPessoaId ? String(body.destinatarioPessoaId).trim() : null;
    const unidadeId = String(body?.unidadeId || "").trim();
    const blocoId = body?.blocoId ? String(body.blocoId).trim() : null;

    const unidadeIdNorm = unitDocId ? "" : normUnidade(unidadeId);
    let blocoIdNorm = blocoId ? normBloco(blocoId) : null;

    let unidadeSnapshot: { unitDocId: string; blocoId: string; blocoNome: string; unidadeNumero: string } | null = null;
    let resolvedBlocoId = blocoId;
    let resolvedUnidadeId = unidadeId;
    let resolvedUnidadeIdNorm = unidadeIdNorm;
    let resolvedBlocoIdNorm = blocoIdNorm;

    if (unitDocId && blocoId) {
      const unidadeRef = db.collection("condominios").doc(condominioId)
        .collection("blocos").doc(blocoId).collection("unidades").doc(unitDocId);
      const unidadeSnap = await unidadeRef.get();
      if (!unidadeSnap.exists) return jsonError("Unidade não encontrada no bloco informado.", 404);
      const ud = unidadeSnap.data() || {};
      if (ud.ativo === false) return jsonError("Unidade está inativa.", 400);

      const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId);
      const blocoSnap = await blocoRef.get();
      if (!blocoSnap.exists) return jsonError("Bloco não encontrado.", 404);
      const bd = blocoSnap.data() || {};
      if (bd.ativo === false) return jsonError("Bloco está inativo.", 400);

      unidadeSnapshot = {
        unitDocId,
        blocoId,
        blocoNome: String(bd.nome || bd.blocoNome || blocoId),
        unidadeNumero: String(ud.numero || ud.unidadeNumero || ""),
      };

      resolvedUnidadeId = unidadeSnapshot.unidadeNumero;
      resolvedUnidadeIdNorm = normUnidade(resolvedUnidadeId);
      resolvedBlocoId = blocoId;
      resolvedBlocoIdNorm = bd.blocoNomeNorm || bd.nomeNorm || normBloco(unidadeSnapshot.blocoNome) || null;

      if (destinatarioPessoaId) {
        const pessoaSnap = await db.collection("condominios").doc(condominioId)
          .collection("pessoas").doc(destinatarioPessoaId).get();
        if (!pessoaSnap.exists) return jsonError("Pessoa não encontrada.", 404);
      }
    } else {
      resolvedUnidadeId = unidadeId;
      resolvedUnidadeIdNorm = normUnidade(unidadeId);
      resolvedBlocoId = blocoId;
      resolvedBlocoIdNorm = blocoId ? normBloco(blocoId) : null;
    }

    const transportadora = String(body?.transportadora || "").trim();
    const observacao = body?.observacao ? String(body.observacao).trim() : null;
    const nfNumero = body?.nfNumero ? String(body.nfNumero).trim() : null;
    const fotoUrl = body?.fotoUrl ? String(body.fotoUrl).trim() : null;

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!resolvedUnidadeIdNorm && !unitDocId) return jsonError("unidadeId é obrigatório", 400);
    if (!transportadora) return jsonError("transportadora é obrigatória", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "PORTEIRO", "ZELADOR"],
      rateLimit: { limit: 30, windowSec: 60 },
    });

    const actorUid = ctx.uid;
    const actorEmail = ctx.email;
    const actorNome = ctx.membroData?.nome || ctx.decodedToken?.name || ctx.decodedToken?.email || "Operador";
    const actorRole = ctx.membroData?.role || ctx.role;

    const codigo = `PKG-${randomCode(8)}`;
    const pinRaw = generatePin(4);
    const pinHashVal = hashPin(pinRaw);
    const qrToken = generateQRToken(72 * 60);
    const qrTokenHashVal = qrToken.hash;

    const encomendaRef = db.collection("condominios").doc(condominioId).collection("encomendas").doc();

    await db.runTransaction(async (tx) => {
      tx.set(encomendaRef, {
        condominioId,
        status: "AGUARDANDO",
        unitDocId: unitDocId || null,
        unidadeSnapshot: unidadeSnapshot || null,
        destinatarioPessoaId: destinatarioPessoaId || null,
        unidadeId: resolvedUnidadeId,
        unidadeIdNorm: resolvedUnidadeIdNorm,
        blocoId: resolvedBlocoId,
        blocoIdNorm: resolvedBlocoIdNorm,
        transportadora,
        nfNumero: nfNumero || null,
        observacoes: observacao,
        fotoUrl: fotoUrl,
        chegouEm: FieldValue.serverTimestamp(),
        codigo: codigo,
        pinHash: pinHashVal,
        // ENCOMENDAS.2G-FIX.1: pinLast4 removido — para um PIN de 4 dígitos,
        // "últimos 4 dígitos" É o PIN inteiro. Não persistir nenhum campo
        // que reconstrua ou equivalha ao PIN utilizável.
        pinExpiresAt: new Date(Date.now() + 72 * 3600000).toISOString(),
        pinAttempts: 0,
        pinLockedUntil: null,
        qrTokenHash: qrTokenHashVal,
        qrIssuedAt: new Date().toISOString(),
        qrExpiresAt: qrToken.expiresAt.toISOString(),
        qrUsed: false,
        // ENCOMENDAS.2E: codigoRetiradaHash removido — campo legado nunca
        // autentica retirada (pinHash é a credencial ativa desde o 2D);
        // manter a escrita só perpetuava um segredo morto sem consumidor.
        retiradaEm: null,
        retiradoPorUid: null,
        criadoPorUid: actorUid,
        criadoPorEmail: ctx.email,
        criadoPorNome: (ctx.decodedToken?.name || ctx.decodedToken?.email || "Operador").toString(),
        registradoPorUid: actorUid,
        registradoPorNome: actorNome,
        registradoPorEmail: actorEmail,
        registradoPorRole: actorRole,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const eventRef = encomendaRef.collection("events").doc();
      tx.set(eventRef, createWithdrawEvent(
        "REGISTERED",
        actorUid,
        String(actorRole || ""),
        String(actorNome || ""),
        { encomendaId: encomendaRef.id, condominioId, scannerSource: body?.scannerSource || "MANUAL" },
      ));
    });

    logEncomendaEvent({
      event: "PACKAGE_CREATE_SUCCESS",
      timestamp: new Date().toISOString(),
      operation: "create",
      result: "success",
      condominioId,
      encomendaId: encomendaRef.id,
      actorUid,
      actorRole: String(actorRole || ""),
      correlationId,
      durationMs: Date.now() - startTime,
    });

    try {
      await notifyUnidade(db, {
        condominioId: String(condominioId),
        unidadeId: String(resolvedUnidadeId),
        blocoId: resolvedBlocoId ?? null,
        encomendaId: String(encomendaRef.id),
        transportadora: transportadora ?? null,
        codigo: codigo ?? null,
      });
    } catch (e: any) {
      console.error("[encomendas/create] falha ao criar notificações:", e?.message || e);
    }

    try {
      let q = db.collection("condominios").doc(condominioId).collection("membros").where("unidadeIdNorm", "==", resolvedUnidadeIdNorm);
      if (resolvedBlocoIdNorm) {
        q = q.where("blocoIdNorm", "==", resolvedBlocoIdNorm);
      }
      const snapMembros = await q.get();
      snapMembros.forEach(async (mDoc: any) => {
        const mData = mDoc.data() || {};
        const toPhone = mData.telefone || "(11) 99999-9999";
        const toName = mData.nome || "Morador";

        await db.collection("condominios").doc(condominioId).collection("whatsappLogs").add({
          toPhone,
          toName,
          message: `Olá ${toName}, sua encomenda da transportadora ${transportadora} chegou na portaria do TreeCondo. Código de retirada: ${codigo}.${fotoUrl ? " Foto do pacote disponível no aplicativo." : ""}`,
          type: "ENCOMENDA_FOTO",
          status: "SENT_SIMULATED",
          sentAt: FieldValue.serverTimestamp(),
          metadata: {
            encomendaId: encomendaRef.id,
            unidadeId,
            codigo,
            fotoUrl: fotoUrl,
          }
        });
      });
    } catch (e) {
      console.error("Erro ao gerar log de WhatsApp para encomenda:", e);
    }

    return NextResponse.json({
      ok: true,
      encomendaId: encomendaRef.id,
      codigo,
    });
  } catch (err: any) {
    if (err instanceof Response) return err;
    logEncomendaEvent({
      event: "PACKAGE_CREATE_FAILED",
      timestamp: new Date().toISOString(),
      operation: "create",
      result: "error",
      condominioId: null,
      actorUid: null,
      errorCode: String(err?.status || 500),
      errorMessage: err?.message || "Erro inesperado no servidor",
      correlationId,
      durationMs: Date.now() - startTime,
    });
    return jsonError(err?.message || "Erro inesperado no servidor", 500);
  }
}
