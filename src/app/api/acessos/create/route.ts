import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rateLimiter";
import { normUnidade, normBloco } from "@/lib/normalization/location";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}



async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  let nome = String(decoded?.name || decoded?.email || "Operador").trim();
  let role: string | null = null;
  let status: string | null = null;
  let blocoId: string | null = null;
  let unidadeId: string | null = null;
  let blocoIdNorm: string | null = null;
  let unidadeIdNorm: string | null = null;

  try {
    const mref = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const msnap = await mref.get();
    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
      if (md?.status) status = String(md.status).trim();
      if (md?.blocoId) blocoId = String(md.blocoId).trim();
      if (md?.unidadeId) unidadeId = String(md.unidadeId).trim();
      if (md?.blocoIdNorm) blocoIdNorm = String(md.blocoIdNorm).trim();
      if (md?.unidadeIdNorm) unidadeIdNorm = String(md.unidadeIdNorm).trim();
    }
  } catch (e: any) {
    console.warn("[acessos/create] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, nome, role, status, blocoId, unidadeId, blocoIdNorm, unidadeIdNorm };
}

async function findMoradoresAlvo(db: any, params: {
  condominioId: string;
  unidadeId: string;
  blocoId?: string | null;
}) {
  const condId = params.condominioId;
  const alvoUn = normUnidade(params.unidadeId);
  const alvoBl = params.blocoId ? normBloco(params.blocoId) : null;

  if (!condId || !alvoUn) return [];

  const membrosRef = db.collection("condominios").doc(condId).collection("membros");

  let q = membrosRef.where("unidadeIdNorm", "==", alvoUn);
  if (alvoBl) q = q.where("blocoIdNorm", "==", alvoBl);

  const snap = await q.get();

  return snap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((m: any) => {
      const role = String(m.role || "").toUpperCase();
      const status = String(m.status || "").toUpperCase();
      return role === "MORADOR" && (status === "ATIVO" || status === "PENDENTE" || status === "");
    });
}

async function createInAppNotifications(db: any, params: {
  condominioId: string;
  uids: string[];
  acessoId: string;
  nome: string;
  blocoId?: string | null;
  unidadeId: string;
}) {
  const { condominioId, uids, acessoId, nome, blocoId, unidadeId } = params;
  if (!uids.length) return 0;

  const batch = db.batch();
  for (const uid of uids) {
    const ref = db.collection("condominios").doc(condominioId).collection("notificacoes").doc();
    const title = "🚪 Novo acesso na portaria";
    const message = `${nome} foi registrado na portaria para sua unidade.`;

    batch.set(ref, {
      tipo: "ACESSO_PORTARIA",
      title,
      message,
      titulo: title,
      mensagem: message,
      targetUid: uid,
      condominioId,
      acessoId,
      blocoId: blocoId ?? null,
      unidadeId,
      lida: false,
      arquivada: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
  return uids.length;
}

async function sendPushToUids(params: {
  db: any;
  uids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const { db, uids, title, body, data } = params;
  if (!uids?.length) {
    return {
      totalTokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidRemoved: 0,
      erros: [] as Array<{ token: string; code: string; message: string }>,
      semToken: [] as string[],
    };
  }

  const tokenDocs: Array<{ uid: string; tokenId: string; token?: string | null }> = [];
  const semToken: string[] = [];

  for (const uid of uids) {
    try {
      const snap = await db.collection("users").doc(uid).collection("fcmTokens").get();
      if (snap.empty) semToken.push(uid);
      snap.forEach((d: any) => tokenDocs.push({ uid, tokenId: d.id, ...(d.data() || {}) }));
    } catch (e: any) {
      console.warn("[FCM] falha lendo tokens do uid", uid, e?.message || String(e));
      semToken.push(uid);
    }
  }

  const tokens = tokenDocs
    .map((t: any) => String(t.token || t.tokenId || "").trim())
    .filter(Boolean);

  if (!tokens.length) {
    return {
      totalTokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidRemoved: 0,
      erros: [] as Array<{ token: string; code: string; message: string }>,
      semToken,
    };
  }

  const msg = adminMessaging();

  const resp = await msg.sendEachForMulticast({
    tokens,
    webpush: {
      notification: {
        title,
        body,
        icon: "/icon-192.png",
      },
      fcmOptions: {
        link: "/acesso",
      },
    },
    data: data || {},
  });

  const invalid: string[] = [];
  const erros: Array<{ token: string; code: string; message: string }> = [];

  resp.responses.forEach((r: any, i: number) => {
    if (r.success) return;
    const code = String(r.error?.code || "");
    const message = String(r.error?.message || "");
    erros.push({ token: tokens[i], code, message });

    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      invalid.push(tokens[i]);
    }
  });

  if (invalid.length) {
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

  return {
    totalTokens: tokens.length,
    successCount: resp.successCount,
    failureCount: resp.failureCount,
    invalidRemoved: invalid.length,
    erros,
    semToken,
  };
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);

    // Rate limiting: máx 20 registros de acesso por minuto por usuário
    const rl = checkRateLimit({
      key: rateLimitKey(decoded.uid, null, "acessos:create"),
      limit: 20,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json().catch(() => ({}));

    const condominioId = String(body?.condominioId || "").trim();
    const tipo = String(body?.tipo || "VISITANTE").trim().toUpperCase();
    const nome = String(body?.nome || "").trim();

    const telefone = body?.telefone ? String(body.telefone).trim() : null;
    const documento = body?.documento ? String(body.documento).trim() : null;
    const placa = body?.placa ? String(body.placa).trim() : null;
    const empresa = body?.empresa ? String(body.empresa).trim() : null;
    const observacao = body?.observacao ? String(body.observacao).trim() : null;

    let blocoId = body?.blocoId ? String(body.blocoId).trim() : null;
    let unidadeId = body?.unidadeId ? String(body.unidadeId).trim() : null;
    let destinoBlocoTexto = body?.destinoBlocoTexto ? String(body.destinoBlocoTexto).trim() : null;
    let destinoUnidadeTexto = body?.destinoUnidadeTexto ? String(body.destinoUnidadeTexto).trim() : null;

    // UN.6B: Canonical unit fields
    const unitDocIdInput = body?.unitDocId ? String(body.unitDocId).trim() : null;
    let destinoUnitDocId: string | null = null;
    let destinoUnidadeSnapshot: any = null;

    // Resolve canonical if provided
    if (unitDocIdInput && blocoId) {
      const unidadeRef = db.collection("condominios").doc(condominioId)
        .collection("blocos").doc(blocoId).collection("unidades").doc(unitDocIdInput);
      const unidadeSnap = await unidadeRef.get();
      if (!unidadeSnap.exists) return jsonError("Unidade não encontrada no bloco informado.", 404);
      const ud = unidadeSnap.data() || {};
      if (ud.ativo === false) return jsonError("Unidade está inativa.", 400);

      const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId);
      const blocoSnap = await blocoRef.get();
      const bd = blocoSnap.exists ? (blocoSnap.data() || {}) : {};

      destinoUnitDocId = unitDocIdInput;
      destinoUnidadeSnapshot = {
        unitDocId: unitDocIdInput,
        blocoId: blocoId,
        blocoNome: String(bd.nome || bd.blocoNome || blocoId),
        unidadeNumero: String(ud.numero || ud.unidadeNumero || ""),
      };

      // Also populate legacy fields from canonical
      unidadeId = destinoUnidadeSnapshot.unidadeNumero || unidadeId;
      destinoBlocoTexto = destinoBlocoTexto || destinoUnidadeSnapshot.blocoNome;
      destinoUnidadeTexto = destinoUnidadeTexto || destinoUnidadeSnapshot.unidadeNumero;
    }

    const janelaInicioRaw = String(body?.janelaInicio || "").trim();
    const janelaFimRaw = String(body?.janelaFim || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!nome) return jsonError("nome é obrigatório", 400);
    if (!janelaInicioRaw || !janelaFimRaw) return jsonError("janelaInicio e janelaFim são obrigatórios", 400);

    const janelaInicio = new Date(janelaInicioRaw);
    const janelaFim = new Date(janelaFimRaw);

    if (Number.isNaN(janelaInicio.getTime()) || Number.isNaN(janelaFim.getTime())) {
      return jsonError("janela inválida", 400);
    }

    const actor = await getActorInfo(db, {
      condominioId,
      uid: decoded.uid,
      decoded,
    });

    const actorRoleUpper = String(actor.role || "").toUpperCase();
    const isSuperAdmin = (decoded as any)?.super_admin === true || (decoded as any)?.superAdmin === true || actorRoleUpper === "SUPER_ADMIN";
    const isAdminCondo = actorRoleUpper === "ADMIN_CONDOMINIO";
    const isAdmin = actorRoleUpper === "ADMIN";
    const isSindico = actorRoleUpper === "SINDICO";
    const isMorador = actorRoleUpper === "MORADOR";

    const hasAccess = isSuperAdmin || isAdminCondo || isAdmin || isSindico || isMorador;

    if (!hasAccess) {
      return jsonError("Você não tem permissão para registrar acessos.", 403);
    }

    if (!isSuperAdmin && String(actor.status || "").toUpperCase() !== "ATIVO") {
      return jsonError("Seu vínculo com o condomínio não está ativo.", 403);
    }

    if (isMorador) {
      const dbUnidadeNorm = actor.unidadeIdNorm || normUnidade(actor.unidadeId);

      if (!dbUnidadeNorm) {
        return jsonError("Morador sem unidade vinculada no cadastro do condomínio.", 403);
      }

      // Não confiar no frontend: sempre usar os valores reais do membro.
      blocoId = actor.blocoId ?? null;
      unidadeId = actor.unidadeId ?? null;
      destinoBlocoTexto = actor.blocoId ?? null;
      destinoUnidadeTexto = actor.unidadeId ?? null;
    }

    const acessoRef = db.collection("condominios").doc(condominioId).collection("acessos").doc();

    await db.runTransaction(async (tx: any) => {
      tx.set(acessoRef, {
        tipo,
        status: "PENDENTE",
        nome,

        telefone,
        documento,
        placa,
        empresa: tipo === "PRESTADOR" ? empresa : null,
        observacao,

        blocoId,
        unidadeId,
        destinoBlocoTexto,
        destinoUnidadeTexto,

        // UN.6B: Canonical fields
        destinoUnitDocId: destinoUnitDocId || null,
        destinoUnidadeSnapshot: destinoUnidadeSnapshot || null,

        moradorUid: decoded.uid,
        moradorNome: actor.nome,

        janelaInicio,
        janelaFim,

        createdByUid: decoded.uid,
        createdByRole: actor.role || "MORADOR",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    let moradoresAlvo: any[] = [];
    if (unidadeId) {
      moradoresAlvo = await findMoradoresAlvo(db, {
        condominioId,
        unidadeId,
        blocoId,
      });
    }

    const uidsAlvo = moradoresAlvo.map((m: any) => String(m.id));

    let notificationsCreated = 0;
    if (uidsAlvo.length) {
      notificationsCreated = await createInAppNotifications(db, {
        condominioId,
        uids: uidsAlvo,
        acessoId: acessoRef.id,
        nome,
        blocoId,
        unidadeId: String(unidadeId || ""),
      });
    }

    const pushResult = await sendPushToUids({
      db,
      uids: uidsAlvo,
      title: "🚪 Novo acesso na portaria",
      body: `${nome} foi registrado para sua unidade.`,
      data: {
        tipo: "ACESSO_PORTARIA",
        acessoId: acessoRef.id,
        condominioId,
        unidadeId: String(unidadeId || ""),
        blocoId: String(blocoId || ""),
        nome,
      },
    });

    return NextResponse.json({
      ok: true,
      acessoId: acessoRef.id,
      targetMoradores: uidsAlvo.length,
      notificationsCreated,
      push: pushResult,
    });
  } catch (e: any) {
    console.error("[api/acessos/create] erro:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e || "erro") },
      { status: 500 }
    );
  }
}
