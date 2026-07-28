import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { sendPushToUids } from "@/lib/serverPush";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rateLimiter";
import { normUnidade, normBloco } from "@/lib/normalization/location";

type StatusAcesso =
  | "PENDENTE"
  | "AUTORIZADO"
  | "NEGADO"
  | "ENTROU"
  | "SAIU"
  | "EXPIRADO"
  | "CANCELADO";

// Próximos status aceitos do cliente (EXPIRADO e PENDENTE são exclusivos do sistema)
const STATUS_PERMITIDOS = new Set<string>([
  "AUTORIZADO",
  "NEGADO",
  "ENTROU",
  "SAIU",
  "CANCELADO",
]);

const GESTOR_ROLES = new Set<string>([
  "SUPER_ADMIN",
  "ADMIN_CONDOMINIO",
  "ADMIN",
  "SINDICO",
]);

const PORTARIA_ROLES = new Set<string>(["PORTEIRO", "SEGURANCA"]);

type GrupoAtor = "MORADOR" | "PORTARIA" | "GESTOR";

// Máquina de estados: estado atual -> próximos status válidos por grupo de ator.
// Estados finais (NEGADO, CANCELADO, SAIU, EXPIRADO) não aparecem como origem.
const TRANSICOES: Record<GrupoAtor, Record<string, string[]>> = {
  MORADOR: {
    PENDENTE: ["AUTORIZADO", "CANCELADO"],
    AUTORIZADO: ["CANCELADO"],
  },
  PORTARIA: {
    PENDENTE: ["NEGADO", "CANCELADO"],
    AUTORIZADO: ["ENTROU", "CANCELADO"],
    ENTROU: ["SAIU"],
  },
  GESTOR: {
    PENDENTE: ["AUTORIZADO", "NEGADO", "CANCELADO"],
    AUTORIZADO: ["ENTROU", "CANCELADO"],
    ENTROU: ["SAIU"],
  },
};

function acoesPermitidasDoGrupo(grupo: GrupoAtor): Set<string> {
  const mapa = TRANSICOES[grupo] || {};
  const acoes = new Set<string>();
  for (const lista of Object.values(mapa)) {
    for (const acao of lista) acoes.add(acao);
  }
  return acoes;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function upper(v: any) {
  return String(v || "").toUpperCase().trim();
}



async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  let nome = String(decoded?.name || decoded?.email || "Usuário").trim();
  let role: string | null = null;
  let status: string | null = null;
  let blocoId: string | null = null;
  let unidadeId: string | null = null;
  let blocoIdNorm: string | null = null;
  let unidadeIdNorm: string | null = null;

  try {
    const msnap = await db.collection("condominios").doc(condominioId).collection("membros").doc(uid).get();
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
    console.warn("[acessos/status] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, nome, role, status, blocoId, unidadeId, blocoIdNorm, unidadeIdNorm };
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

function buildStatusPatch(params: { next: StatusAcesso; actorUid: string; actorNome: string; actorRole: string | null }) {
  const { next, actorUid, actorNome, actorRole } = params;

  const patch: Record<string, any> = {
    status: next,
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUid: actorUid,
    updatedByNome: actorNome,
    updatedByRole: actorRole ?? null,
  };

  if (next === "AUTORIZADO") {
    patch.autorizadoPorUid = actorUid;
    patch.autorizadoPorNome = actorNome;
    patch.autorizadoPorRole = actorRole ?? null;
    patch.autorizadoEm = FieldValue.serverTimestamp();
  }
  if (next === "NEGADO") {
    patch.negadoPorUid = actorUid;
    patch.negadoPorNome = actorNome;
    patch.negadoPorRole = actorRole ?? null;
    patch.negadoEm = FieldValue.serverTimestamp();
  }
  if (next === "ENTROU") {
    patch.entradaPorUid = actorUid;
    patch.entradaPorNome = actorNome;
    patch.entradaPorRole = actorRole ?? null;
    patch.entradaEm = FieldValue.serverTimestamp();
  }
  if (next === "SAIU") {
    patch.saidaPorUid = actorUid;
    patch.saidaPorNome = actorNome;
    patch.saidaPorRole = actorRole ?? null;
    patch.saidaEm = FieldValue.serverTimestamp();
  }
  if (next === "CANCELADO") {
    patch.canceladoPorUid = actorUid;
    patch.canceladoPorNome = actorNome;
    patch.canceladoPorRole = actorRole ?? null;
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

    // Rate limiting: máx 20 alterações de status por minuto por usuário
    const rl = checkRateLimit({
      key: rateLimitKey(decoded.uid, null, "acessos:status"),
      limit: 20,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json().catch(() => ({}));

    const condominioId = String(body?.condominioId || "").trim();
    const acessoId = String(body?.acessoId || "").trim();
    const next = upper(body?.next) as StatusAcesso;

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!acessoId) return jsonError("acessoId é obrigatório", 400);
    if (!next) return jsonError("next é obrigatório", 400);
    if (!STATUS_PERMITIDOS.has(next)) return jsonError("Status de acesso inválido.", 400);

    const actor = await getActorInfo(db, {
      condominioId,
      uid: decoded.uid,
      decoded,
    });

    const actorRoleUpper = upper(actor.role);
    const isSuperAdmin =
      (decoded as any)?.super_admin === true ||
      (decoded as any)?.superAdmin === true ||
      actorRoleUpper === "SUPER_ADMIN";

    let grupo: GrupoAtor | null = null;
    if (isSuperAdmin || GESTOR_ROLES.has(actorRoleUpper)) grupo = "GESTOR";
    else if (PORTARIA_ROLES.has(actorRoleUpper)) grupo = "PORTARIA";
    else if (actorRoleUpper === "MORADOR") grupo = "MORADOR";

    if (!grupo) {
      return jsonError("Você não tem permissão para alterar o status do acesso.", 403);
    }

    if (!isSuperAdmin && upper(actor.status) !== "ATIVO") {
      return jsonError("Seu vínculo com o condomínio não está ativo.", 403);
    }

    const acessoRef = db.collection("condominios").doc(condominioId).collection("acessos").doc(acessoId);
    const acessoSnap = await acessoRef.get();
    if (!acessoSnap.exists) return jsonError("Acesso não encontrado.", 404);

    const acesso = acessoSnap.data() || {};

    const acessoCondominioId = acesso?.condominioId ? String(acesso.condominioId).trim() : null;
    if (acessoCondominioId && acessoCondominioId !== condominioId) {
      return jsonError("Acesso não pertence a este condomínio.", 403);
    }

    // MORADOR só opera acessos próprios: criado por morador, dono do vínculo e da mesma unidade.
    if (grupo === "MORADOR") {
      const createdByRole = upper(acesso?.createdByRole);
      const acessoMoradorUid = acesso?.moradorUid ? String(acesso.moradorUid).trim() : "";
      const acessoUnNorm = normUnidade(acesso?.unidadeId);
      const acessoBlNorm = acesso?.blocoId ? normBloco(acesso.blocoId) : "";
      const actorUnNorm = actor.unidadeIdNorm || normUnidade(actor.unidadeId);
      const actorBlNorm = actor.blocoIdNorm || (actor.blocoId ? normBloco(actor.blocoId) : "");

      const isDono =
        createdByRole === "MORADOR" &&
        acessoMoradorUid === String(decoded.uid) &&
        !!acessoUnNorm &&
        !!actorUnNorm &&
        acessoUnNorm === actorUnNorm &&
        (!acessoBlNorm || !actorBlNorm || acessoBlNorm === actorBlNorm);

      if (!isDono) {
        return jsonError("Você só pode operar acessos da sua própria unidade.", 403);
      }
    }

    // Validação de ação por perfil (403) e de transição de estado (409).
    if (!acoesPermitidasDoGrupo(grupo).has(next)) {
      return jsonError("Ação não permitida para o seu perfil.", 403);
    }

    const statusAtual = upper(acesso?.status);
    const transicoesValidas = TRANSICOES[grupo][statusAtual] || [];
    if (!transicoesValidas.includes(next)) {
      return jsonError(`Transição de status inválida (${statusAtual || "SEM_STATUS"} → ${next}).`, 409);
    }

    await acessoRef.set(
      buildStatusPatch({
        next,
        actorUid: String(decoded.uid),
        actorNome: actor.nome,
        actorRole: actor.role,
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
