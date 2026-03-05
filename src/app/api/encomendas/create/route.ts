
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { createHash, randomBytes } from "crypto";
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
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

function normUnidade(v: any) {
  return String(v || "")
    .toLowerCase()
    .replace(/\b(apto|apt|apartamento|unidade)\b/gi, "")
    .replace(/[^0-9a-z]/gi, "")
    .trim();
}
function normBloco(v: any) {
  return String(v || "").toLowerCase().trim();
}

async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  const email = String(decoded?.email || "").toLowerCase();
  let nome = String(decoded?.name || decoded?.email || "Operador").trim();
  let role: string | null = null;

  try {
    const mref = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const msnap = await mref.get();
    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
    }
  } catch (e: any) {
    console.warn("[encomendas/create] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, email, nome, role };
}

async function notifyUnidade(db: any, params: {
  condominioId: string;
  unidadeId: string;
  blocoId?: string | null;
  encomendaId: string;
  transportadora?: string | null;
  codigo?: string | null;
}) {
  const condId = params.condominioId;
  const unidadeId = String(params.unidadeId || "").trim();
  if (!condId || !unidadeId) return;

  const alvoUn = normUnidade(unidadeId);
  const alvoBl = (params.blocoId ?? null) ? normBloco(params.blocoId) : null;

  const membrosRef = db.collection("condominios").doc(condId).collection("membros");
  
  let q = membrosRef.where("unidadeIdNorm", "==", alvoUn);
  if (alvoBl) {
    q = q.where("blocoIdNorm", "==", alvoBl);
  }
  
  const snap = await q.get();

  const membros = snap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((m: any) => {
      const st = String(m.status || "").toUpperCase();
      return (st === "ATIVO" || st === "PENDENTE");
    });

  if (membros.length === 0) {
    console.log("[encomendas/create] Nenhum morador (ATIVO/PENDENTE) encontrado para unidade:", unidadeId, "bloco:", (params.blocoId ?? null));
    return;
  }

  const batch = db.batch();
  membros.forEach((m: any) => {
    const uid = m.id;
    const ref = db.collection("condominios").doc(condId).collection("notificacoes").doc();
    const title = "📦 Encomenda chegou";
    const transp = params.transportadora ? ` (${params.transportadora})` : "";
    const message = `Sua encomenda${transp} chegou. Retire na portaria.`;

    batch.set(ref, {
      tipo: "ENCOMENDA_CHEGOU",
      title,
      message,
      titulo: title,
      mensagem: message,
      targetUid: uid,
      condominioId: condId,
      encomendaId: params.encomendaId,
      unidadeId: params.unidadeId,
      blocoId: params.blocoId ?? null,
      lida: false,
      arquivada: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();
  console.log("[encomendas/create] Notificações criadas para", membros.length, "moradores da unidade", unidadeId);
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
      notification: {
        title,
        body,
        icon: "/icons/icon-192.png",
      },
      fcmOptions: {
        link: "/encomendas",
      },
    },
    data: data || {},
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

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return jsonError("Token ausente (Authorization: Bearer ...)", 401);
    }
    const decoded = await aauth.verifyIdToken(token);

    const body = await req.json().catch(() => ({}));
    console.log("[API/encomendas/create] Body recebido:", body);

    const condominioId = String(body?.condominioId || "").trim();
    const unidadeId = String(body?.unidadeId || "").trim();
    const blocoId = body?.blocoId ? String(body.blocoId).trim() : null;

    const unidadeIdNorm = normUnidade(unidadeId);
    const blocoIdNorm = blocoId ? normBloco(blocoId) : null;
    const transportadora = String(body?.transportadora || "").trim();
    const observacao = body?.observacao ? String(body.observacao).trim() : null;
      const nfNumero = body?.nfNumero ? String(body.nfNumero).trim() : null;

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!unidadeIdNorm) return jsonError("unidadeId é obrigatório", 400);
    if (!transportadora) return jsonError("transportadora é obrigatória", 400);

    const codigo = `PKG-${randomCode(8)}`;
    const codigoRetiradaHash = sha256(codigo);
    const codigoRetiradaLast4 = codigo.slice(-4);
    
    const encomendaRef = db.collection("condominios").doc(condominioId).collection("encomendas").doc();

      const actor = await getActorInfo(db, { condominioId, uid: decoded.uid, decoded });
    await db.runTransaction(async (tx) => {
      tx.set(encomendaRef, {
        condominioId,
        status: "AGUARDANDO",
        unidadeId,
        unidadeIdNorm,
        blocoId,
        blocoIdNorm,
        transportadora,
          nfNumero: nfNumero || null,
          observacoes: observacao,
        chegouEm: FieldValue.serverTimestamp(),
        codigo: codigo,
        codigoRetiradaHash,
        codigoRetiradaLast4,
          codigoRetirada: codigo,
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
    });

    console.log("[API/encomendas/create] Sucesso:", { ok: true, encomendaId: encomendaRef.id, codigo });
    
    try {
      await notifyUnidade(db, {
        condominioId: String(condominioId),
        unidadeId: String(unidadeId),
        blocoId: blocoId ?? null,
        encomendaId: String(encomendaRef.id),
        transportadora: transportadora ?? null,
        codigo: codigo ?? null,
      });
    } catch (e: any) {
      console.error("[encomendas/create] falha ao criar notificações:", e?.message || e);
    }

    return NextResponse.json({
      ok: true,
      encomendaId: encomendaRef.id,
      codigo,
    });
  } catch (err: any) {
    console.error("[API/encomendas/create] Erro:", err);
    return jsonError(err?.message || "Erro inesperado no servidor", 500);
  }
}
