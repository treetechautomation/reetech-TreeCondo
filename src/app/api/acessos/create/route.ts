import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

async function findMoradoresAlvo(db: any, params: { condominioId: string; unidadeId: string; blocoId?: string | null }) {
  const condId = params.condominioId;
  const alvoUn = normUnidade(params.unidadeId);
  const alvoBl = params.blocoId ? normBloco(params.blocoId) : null;
  if (!condId || !alvoUn) return [];

  const membrosRef = db.collection("condominios").doc(condId).collection("membros");
  let q = membrosRef.where("unidadeIdNorm", "==", alvoUn);
  if (alvoBl) q = q.where("blocoIdNorm", "==", alvoBl);
  const snap = await q.get();
  return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) })).filter((m: any) => {
    const role = String(m.role || "").toUpperCase();
    const status = String(m.status || "").toUpperCase();
    return role === "MORADOR" && (status === "ATIVO" || status === "PENDENTE" || status === "");
  });
}

async function createInAppNotifications(db: any, params: { condominioId: string; uids: string[]; acessoId: string; nome: string; blocoId?: string | null; unidadeId: string }) {
  const { condominioId, uids, acessoId, nome, blocoId, unidadeId } = params;
  if (!uids.length) return 0;
  const batch = db.batch();
  for (const uid of uids) {
    const ref = db.collection("condominios").doc(condominioId).collection("notificacoes").doc();
    batch.set(ref, { tipo: "ACESSO_PORTARIA", title: "🚪 Novo acesso na portaria", message: `${nome} foi registrado na portaria para sua unidade.`, titulo: "🚪 Novo acesso na portaria", mensagem: `${nome} foi registrado na portaria para sua unidade.`, targetUid: uid, condominioId, acessoId, blocoId: blocoId ?? null, unidadeId, lida: false, arquivada: false, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await batch.commit();
  return uids.length;
}

async function sendPushToUids(params: { db: any; uids: string[]; title: string; body: string; data?: Record<string, string> }) {
  const { db, uids, title, body, data } = params;
  if (!uids?.length) return { totalTokens: 0, successCount: 0, failureCount: 0, invalidRemoved: 0, erros: [] as any[], semToken: [] as string[] };

  const tokenDocs: Array<{ uid: string; tokenId: string; token?: string | null }> = [];
  const semToken: string[] = [];
  for (const uid of uids) {
    try {
      const snap = await db.collection("users").doc(uid).collection("fcmTokens").get();
      if (snap.empty) semToken.push(uid);
      snap.forEach((d: any) => tokenDocs.push({ uid, tokenId: d.id, ...(d.data() || {}) }));
    } catch (e: any) { semToken.push(uid); }
  }

  const tokens = tokenDocs.map((t: any) => String(t.token || t.tokenId || "").trim()).filter(Boolean);
  if (!tokens.length) return { totalTokens: 0, successCount: 0, failureCount: 0, invalidRemoved: 0, erros: [], semToken };

  const msg = adminMessaging();
  const resp = await msg.sendEachForMulticast({ tokens, webpush: { notification: { title, body, icon: "/icon-192.png" }, fcmOptions: { link: "/acesso" } }, data: data || {} });

  const invalid: string[] = [];
  const erros: any[] = [];
  resp.responses.forEach((r: any, i: number) => {
    if (r.success) return;
    const code = String(r.error?.code || "");
    erros.push({ token: tokens[i], code, message: String(r.error?.message || "") });
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") invalid.push(tokens[i]);
  });

  if (invalid.length) {
    await Promise.all(invalid.map(async (tok) => {
      const td = tokenDocs.find((x: any) => (x.token || x.tokenId) === tok);
      if (td?.uid) { try { await db.collection("users").doc(td.uid).collection("fcmTokens").doc(tok).delete(); } catch {} }
    }));
  }

  return { totalTokens: tokens.length, successCount: resp.successCount, failureCount: resp.failureCount, invalidRemoved: invalid.length, erros, semToken };
}

export async function POST(req: Request) {
  const db = adminDb();

  try {
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

    const unitDocIdInput = body?.unitDocId ? String(body.unitDocId).trim() : null;
    let destinoUnitDocId: string | null = null;
    let destinoUnidadeSnapshot: any = null;

    const janelaInicioRaw = String(body?.janelaInicio || "").trim();
    const janelaFimRaw = String(body?.janelaFim || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!nome) return jsonError("nome é obrigatório", 400);
    if (!janelaInicioRaw || !janelaFimRaw) return jsonError("janelaInicio e janelaFim são obrigatórios", 400);

    const janelaInicio = new Date(janelaInicioRaw);
    const janelaFim = new Date(janelaFimRaw);
    if (Number.isNaN(janelaInicio.getTime()) || Number.isNaN(janelaFim.getTime())) return jsonError("janela inválida", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "MORADOR"],
    });

    const actor = ctx.membroData || {};
    const actorRole = ctx.role || "";
    const isMorador = actorRole === "MORADOR";

    if (unitDocIdInput && blocoId) {
      const unidadeRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId).collection("unidades").doc(unitDocIdInput);
      const unidadeSnap = await unidadeRef.get();
      if (!unidadeSnap.exists) return jsonError("Unidade não encontrada no bloco informado.", 404);
      const ud = unidadeSnap.data() || {};
      if (ud.ativo === false) return jsonError("Unidade está inativa.", 400);

      const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId);
      const blocoSnap = await blocoRef.get();
      const bd = blocoSnap.exists ? (blocoSnap.data() || {}) : {};

      destinoUnitDocId = unitDocIdInput;
      destinoUnidadeSnapshot = { unitDocId: unitDocIdInput, blocoId, blocoNome: String(bd.nome || bd.blocoNome || blocoId), unidadeNumero: String(ud.numero || ud.unidadeNumero || "") };
      unidadeId = destinoUnidadeSnapshot.unidadeNumero || unidadeId;
      destinoBlocoTexto = destinoBlocoTexto || destinoUnidadeSnapshot.blocoNome;
      destinoUnidadeTexto = destinoUnidadeTexto || destinoUnidadeSnapshot.unidadeNumero;
    }

    if (isMorador) {
      const dbUnidadeNorm = (actor as any).unidadeIdNorm || normUnidade((actor as any).unidadeId);
      if (!dbUnidadeNorm) return jsonError("Morador sem unidade vinculada.", 403);
      blocoId = (actor as any).blocoId ?? null;
      unidadeId = (actor as any).unidadeId ?? null;
      destinoBlocoTexto = (actor as any).blocoId ?? null;
      destinoUnidadeTexto = (actor as any).unidadeId ?? null;
    }

    const actorNome = String((actor as any).nome || ctx.decodedToken?.name || ctx.email || "Operador");

    const acessoRef = db.collection("condominios").doc(condominioId).collection("acessos").doc();

    await db.runTransaction(async (tx: any) => {
      tx.set(acessoRef, {
        tipo, status: "PENDENTE", nome,
        telefone, documento, placa, empresa: tipo === "PRESTADOR" ? empresa : null, observacao,
        blocoId, unidadeId, destinoBlocoTexto, destinoUnidadeTexto,
        destinoUnitDocId: destinoUnitDocId || null, destinoUnidadeSnapshot: destinoUnidadeSnapshot || null,
        moradorUid: ctx.uid, moradorNome: actorNome,
        janelaInicio, janelaFim,
        createdByUid: ctx.uid, createdByRole: actorRole || "MORADOR",
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    });

    let moradoresAlvo: any[] = [];
    if (unidadeId) {
      moradoresAlvo = await findMoradoresAlvo(db, { condominioId, unidadeId, blocoId });
    }

    const uidsAlvo = moradoresAlvo.map((m: any) => String(m.id));
    let notificationsCreated = 0;
    if (uidsAlvo.length) {
      notificationsCreated = await createInAppNotifications(db, { condominioId, uids: uidsAlvo, acessoId: acessoRef.id, nome, blocoId, unidadeId: String(unidadeId || "") });
    }

    const pushResult = await sendPushToUids({ db, uids: uidsAlvo, title: "🚪 Novo acesso na portaria", body: `${nome} foi registrado para sua unidade.`, data: { tipo: "ACESSO_PORTARIA", acessoId: acessoRef.id, condominioId, unidadeId: String(unidadeId || ""), blocoId: String(blocoId || ""), nome } });

    return NextResponse.json({ ok: true, acessoId: acessoRef.id, targetMoradores: uidsAlvo.length, notificationsCreated, push: pushResult });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("[api/acessos/create] erro:", e);
    return jsonError(String(e?.message || e || "erro"), 500);
  }
}
