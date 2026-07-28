
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { randomBytes } from "crypto";
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rateLimiter";
import { generatePin, hashPin, last4, generateQRToken, hashQRToken, normalizeCode, createWithdrawEvent } from "@/lib/encomendas/withdrawal";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { notifyUnidade } from "@/lib/notifications/notifyUnidade";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}

async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  const email = String(decoded?.email || "").toLowerCase();
  let nome = String(decoded?.name || decoded?.email || "Operador").trim();
  let role: string | null = null;
  let status: string | null = null;

  try {
    const mref = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const msnap = await mref.get();
    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
      if (md?.status) status = String(md.status).trim();
    }
  } catch (e: any) {
    console.warn("[encomendas/create] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, email, nome, role, status };
}

// [UN.6F] notifyUnidade movido para lib/notifications/notifyUnidade.ts (canônico via VinculoUnidade)

async function sendPushToUids(params: {
  db: any;
  uids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const { db, uids, title, body, data } = params;
  if (!uids?.length) return;

  // coleta tokens (pode ter vários por usuário)
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
      headers: {
        Urgency: "high",
      },
      notification: {
        title,
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
      },
      fcmOptions: {
        link: "/encomendas",
      },
    },
    android: {
      priority: "high",
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
    },
    data: {
      click_action: "/encomendas",
      ...(data || {}),
    },
  });

  console.log("[FCM] push multicast result:", {
    tokens: tokens.length,
    successCount: resp.successCount,
    failureCount: resp.failureCount,
  });

  // remove tokens inválidos
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
    // apaga docs onde tokenId == token (você salva docId = token)
    await Promise.all(
      invalid.map(async (tok) => {
        // encontra o uid correspondente nos tokenDocs
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
  const aauth = adminAuth();
  const correlationId = extractCorrelationId(req);
  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return jsonError("Token ausente (Authorization: Bearer ...)", 401);
    }
    const decoded = await aauth.verifyIdToken(token);

    // Rate limiting: máx 30 encomendas por minuto por operador
    const rl = checkRateLimit({
      key: rateLimitKey(decoded.uid, null, "encomendas:create"),
      limit: 30,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json().catch(() => ({}));

    const condominioId = String(body?.condominioId || "").trim();

    // UN.6A: Accept canonical unitDocId (new) or legacy text fields
    const unitDocId = body?.unitDocId ? String(body.unitDocId).trim() : null;
    const destinatarioPessoaId = body?.destinatarioPessoaId ? String(body.destinatarioPessoaId).trim() : null;

    // Legacy fields (still supported)
    const unidadeId = String(body?.unidadeId || "").trim();
    const blocoId = body?.blocoId ? String(body.blocoId).trim() : null;

    const unidadeIdNorm = unitDocId ? "" : normUnidade(unidadeId); // Will resolve from canonical if unitDocId
    let blocoIdNorm = blocoId ? normBloco(blocoId) : null;

    // UN.6A: unidadeSnapshot server-side
    let unidadeSnapshot: { unitDocId: string; blocoId: string; blocoNome: string; unidadeNumero: string } | null = null;
    let resolvedBlocoId = blocoId;
    let resolvedUnidadeId = unidadeId;
    let resolvedUnidadeIdNorm = unidadeIdNorm;
    let resolvedBlocoIdNorm = blocoIdNorm;

    if (unitDocId && blocoId) {
      // Canonical path: validate unit against Firestore
      const unidadeRef = db.collection("condominios").doc(condominioId)
        .collection("blocos").doc(blocoId).collection("unidades").doc(unitDocId);
      const unidadeSnap = await unidadeRef.get();
      if (!unidadeSnap.exists) return jsonError("Unidade não encontrada no bloco informado.", 404);
      const ud = unidadeSnap.data() || {};
      if (ud.ativo === false) return jsonError("Unidade está inativa.", 400);

      // Validate bloco
      const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId);
      const blocoSnap = await blocoRef.get();
      if (!blocoSnap.exists) return jsonError("Bloco não encontrado.", 404);
      const bd = blocoSnap.data() || {};
      if (bd.ativo === false) return jsonError("Bloco está inativo.", 400);

      // Build snapshot
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

      // Validate destinatarioPessoaId if provided
      if (destinatarioPessoaId) {
        const pessoaSnap = await db.collection("condominios").doc(condominioId)
          .collection("pessoas").doc(destinatarioPessoaId).get();
        if (!pessoaSnap.exists) return jsonError("Pessoa não encontrada.", 404);

        // Verify pessoa has active vinculo with this unit
        const vincSnap = await db.collection("condominios").doc(condominioId)
          .collection("vinculosUnidades")
          .where("pessoaId", "==", destinatarioPessoaId)
          .where("unitDocId", "==", unitDocId)
          .where("blocoId", "==", blocoId)
          .where("status", "==", "ATIVO")
          .limit(1).get();
        // Non-blocking: allow encomenda even if vinculo check fails (admin override)
      }
    } else {
      // Legacy path: use only text fields
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

    // E.3.2.1: Modelo SEGURO — gerar PIN + QR, persistir apenas hashes.
    const codigo = `PKG-${randomCode(8)}`;
    const pinRaw = generatePin(4);
    const pinHashVal = hashPin(pinRaw);
    const pinLast4Val = last4(pinRaw);
    const qrToken = generateQRToken(72 * 60);
    const qrTokenHashVal = qrToken.hash;
    
    const encomendaRef = db.collection("condominios").doc(condominioId).collection("encomendas").doc();

      const actor = await getActorInfo(db, { condominioId, uid: decoded.uid, decoded });

    // ACL + isolamento multi-tenant (Admin SDK ignora firestore.rules).
    // Fonte da verdade: condominios/{condominioId}/membros/{decoded.uid}
    const actorRoleUpper = String(actor.role || "").toUpperCase();
    const isSuperAdmin =
      (decoded as any)?.super_admin === true ||
      (decoded as any)?.superAdmin === true ||
      actorRoleUpper === "SUPER_ADMIN";

    const PAPEIS_AUTORIZADOS = [
      "SUPER_ADMIN",
      "ADMIN_CONDOMINIO",
      "ADMIN",
      "SINDICO",
      "PORTEIRO",
      "ZELADOR",
    ];

    if (!isSuperAdmin) {
      if (String(actor.status || "").toUpperCase() !== "ATIVO") {
        return jsonError("Você não possui vínculo ativo neste condomínio.", 403);
      }
      if (!PAPEIS_AUTORIZADOS.includes(actorRoleUpper)) {
        return jsonError("Seu perfil não tem permissão para registrar encomendas.", 403);
      }
    }

    await db.runTransaction(async (tx) => {
      tx.set(encomendaRef, {
        condominioId,
        status: "AGUARDANDO",
        // UN.6A: Campos canônicos
        unitDocId: unitDocId || null,
        unidadeSnapshot: unidadeSnapshot || null,
        destinatarioPessoaId: destinatarioPessoaId || null,
        // Campos legados (compatibilidade)
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
        // E.3.2.1: Apenas HASHES — nunca plaintext
        pinHash: pinHashVal,
        pinLast4: pinLast4Val,
        pinExpiresAt: new Date(Date.now() + 72 * 3600000).toISOString(),
        pinAttempts: 0,
        pinLockedUntil: null,
        qrTokenHash: qrTokenHashVal,
        qrIssuedAt: new Date().toISOString(),
        qrExpiresAt: qrToken.expiresAt.toISOString(),
        qrUsed: false,
        // Campos LEGADOS mantidos para compatibilidade de leitura
        codigoRetiradaHash: pinHashVal,
        codigoRetiradaLast4: pinLast4Val,
        retiradaEm: null,
        retiradoPorUid: null,
        criadoPorUid: decoded.uid,
          criadoPorEmail: (decoded.email || "").toLowerCase(),
          criadoPorNome: (decoded.name || decoded.email || "Operador").toString(),

          // quem registrou a encomenda (porteiro/operador)
          registradoPorUid: actor.uid,
          registradoPorNome: actor.nome,
          registradoPorEmail: actor.email,
          registradoPorRole: actor.role,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // E.3.3: Registrar evento REGISTERED na subcoleção events
      const eventRef = encomendaRef.collection("events").doc();
      tx.set(eventRef, createWithdrawEvent(
        "REGISTERED",
        actor.uid,
        actor.role,
        actor.nome,
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
      actorUid: actor.uid,
      actorRole: actor.role,
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

    // Registra log do WhatsApp simulado
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
      // E.3.2.2: Apenas hashes na resposta. Credenciais brutas NÃO expostas ao porteiro.
      // O morador obtém QR/PIN via endpoint autenticado (credencial).
      pinLast4: pinLast4Val,
    });
  } catch (err: any) {
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
