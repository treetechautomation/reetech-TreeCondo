import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { sendPushToUids } from "@/lib/serverPush";

type StatusAcesso =
  | "PENDENTE"
  | "AUTORIZADO"
  | "NEGADO"
  | "ENTROU"
  | "SAIU"
  | "EXPIRADO"
  | "CANCELADO";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function upper(v: any) {
  return String(v || "").toUpperCase().trim();
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
  let nome = String(decoded?.name || decoded?.email || "Usuário").trim();
  let role: string | null = null;

  try {
    const msnap = await db.collection("condominios").doc(condominioId).collection("membros").doc(uid).get();
    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
    }
  } catch (e: any) {
    console.warn("[acessos/status] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, nome, role };
}

async function findMoradoresAlvo(db: any, params: {
  condominioId: string;
  unidadeId?: string | null;
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
      const role = upper(m.role);
      const status = upper(m.status);
      return role === "MORADOR" && (status === "ATIVO" || status === "PENDENTE" || status === "");
    });
}

async function createInAppNotifications(db: any, params: {
  condominioId: string;
  uids: string[];
  tipo: string;
  title: string;
  message: string;
  acessoId: string;
  blocoId?: string | null;
  unidadeId?: string | null;
}) {
  const { condominioId, uids, tipo, title, message, acessoId, blocoId, unidadeId } = params;
  if (!uids.length) return 0;

  const batch = db.batch();
  for (const uid of Array.from(new Set(uids.map((x) => String(x || "").trim()).filter(Boolean)))) {
    const ref = db.collection("condominios").doc(condominioId).collection("notificacoes").doc();
    batch.set(ref, {
      tipo,
      title,
      message,
      titulo: title,
      mensagem: message,
      targetUid: uid,
      condominioId,
      acessoId,
      blocoId: blocoId ?? null,
      unidadeId: unidadeId ?? null,
      lida: false,
      arquivada: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
  return uids.length;
}

function buildStatusPatch(params: { next: StatusAcesso; actorUid: string; actorNome: string }) {
  const { next, actorUid, actorNome } = params;

  const patch: Record<string, any> = {
    status: next,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (next === "AUTORIZADO") {
    patch.autorizadoPorUid = actorUid;
    patch.autorizadoPorNome = actorNome;
    patch.autorizadoEm = FieldValue.serverTimestamp();
  }
  if (next === "NEGADO") {
    patch.negadoPorUid = actorUid;
    patch.negadoPorNome = actorNome;
    patch.negadoEm = FieldValue.serverTimestamp();
  }
  if (next === "ENTROU") {
    patch.entradaPorUid = actorUid;
    patch.entradaPorNome = actorNome;
    patch.entradaEm = FieldValue.serverTimestamp();
  }
  if (next === "SAIU") {
    patch.saidaPorUid = actorUid;
    patch.saidaPorNome = actorNome;
    patch.saidaEm = FieldValue.serverTimestamp();
  }
  if (next === "CANCELADO") {
    patch.canceladoPorUid = actorUid;
    patch.canceladoPorNome = actorNome;
    patch.canceladoEm = FieldValue.serverTimestamp();
  }

  return patch;
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);
    const body = await req.json().catch(() => ({}));

    const condominioId = String(body?.condominioId || "").trim();
    const acessoId = String(body?.acessoId || "").trim();
    const next = upper(body?.next) as StatusAcesso;

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!acessoId) return jsonError("acessoId é obrigatório", 400);
    if (!next) return jsonError("next é obrigatório", 400);

    const actor = await getActorInfo(db, {
      condominioId,
      uid: decoded.uid,
      decoded,
    });

    const acessoRef = db.collection("condominios").doc(condominioId).collection("acessos").doc(acessoId);
    const acessoSnap = await acessoRef.get();
    if (!acessoSnap.exists) return jsonError("Acesso não encontrado.", 404);

    const acesso = acessoSnap.data() || {};

    await acessoRef.set(
      buildStatusPatch({
        next,
        actorUid: String(decoded.uid),
        actorNome: actor.nome,
      }),
      { merge: true }
    );

    const blocoId = acesso?.blocoId ? String(acesso.blocoId).trim() : null;
    const unidadeId = acesso?.unidadeId ? String(acesso.unidadeId).trim() : null;
    const nomeVisitante = String(acesso?.nome || "Visitante").trim();
    const moradorUid = acesso?.moradorUid ? String(acesso.moradorUid).trim() : null;

    let uidsNotify: string[] = [];
    let notifTitle = "";
    let notifBody = "";
    let notifTipo = "";

    if (next === "ENTROU") {
      const moradores = await findMoradoresAlvo(db, { condominioId, unidadeId, blocoId });
      uidsNotify = moradores.map((m: any) => String(m.id));
      notifTipo = "ACESSO_ENTRADA_CONFIRMADA";
      notifTitle = "✅ Chegada confirmada na portaria";
      notifBody = `${nomeVisitante} entrou no condomínio para a sua unidade.`;
    } else if (next === "AUTORIZADO" && moradorUid) {
      uidsNotify = [moradorUid];
      notifTipo = "ACESSO_AUTORIZADO";
      notifTitle = "✅ Acesso autorizado";
      notifBody = `${nomeVisitante} foi autorizado para a sua unidade.`;
    } else if (next === "NEGADO" && moradorUid) {
      uidsNotify = [moradorUid];
      notifTipo = "ACESSO_NEGADO";
      notifTitle = "⛔ Acesso negado";
      notifBody = `${nomeVisitante} teve o acesso negado.`;
    } else if (next === "CANCELADO" && moradorUid) {
      uidsNotify = [moradorUid];
      notifTipo = "ACESSO_CANCELADO";
      notifTitle = "🚫 Acesso cancelado";
      notifBody = `${nomeVisitante} teve o acesso cancelado.`;
    } else if (next === "SAIU") {
      const moradores = await findMoradoresAlvo(db, { condominioId, unidadeId, blocoId });
      uidsNotify = moradores.map((m: any) => String(m.id));
      notifTipo = "ACESSO_SAIDA_CONFIRMADA";
      notifTitle = "👋 Saída registrada";
      notifBody = `${nomeVisitante} saiu do condomínio.`;
    }

    let notificationsCreated = 0;
    let pushResult: any = {
      totalTokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidRemoved: 0,
      erros: [],
      semToken: [],
    };

    if (uidsNotify.length && notifTitle && notifBody) {
      notificationsCreated = await createInAppNotifications(db, {
        condominioId,
        uids: uidsNotify,
        tipo: notifTipo,
        title: notifTitle,
        message: notifBody,
        acessoId,
        blocoId,
        unidadeId,
      });

      pushResult = await sendPushToUids({
        db,
        uids: uidsNotify,
        title: notifTitle,
        body: notifBody,
        link: "/acesso",
        data: {
          tipo: notifTipo,
          acessoId,
          condominioId,
          blocoId: blocoId || "",
          unidadeId: unidadeId || "",
          click_action: "/acesso",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      acessoId,
      next,
      notificationsCreated,
      pushResult,
    });
  } catch (err: any) {
    const status = Number(err?.status || 0) || 500;
    console.error("[API acessos/status] erro:", err);
    return jsonError(String(err?.message || "Erro inesperado"), status);
  }
}
