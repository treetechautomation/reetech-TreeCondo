/* eslint-disable require-jsdoc */
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {onDocumentCreated} from "firebase-functions/v2/firestore";

// Triggers
import {onMembroCreated} from "./triggers/onMembroCreated";
export {onMembroCreated};

// Callables
export {acceptInvite} from "./callables/acceptInvite";
export {adminCreateMorador} from "./callables/adminCreateMorador";
export {adminCreateMembro} from "./callables/adminCreateMembro";

admin.initializeApp();
const db = admin.firestore();

function generateTempPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ" +
    "abcdefghijkmnopqrstuvwxyz" +
    "23456789";
  const length = 10;
  let result = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * chars.length);
    result += chars.charAt(index);
  }
  return result;
}

export const onConviteCreated = onDocumentCreated(
  "convites/{conviteId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const convite = snap.data() as {nome: string;
      email: string;
      condominioId: string;
      tipo: string;
      status?: string;};

    if (convite.status === "PROCESSADO") return;

    // REV.1 — Guarda de reativação: este trigger legado reprovisiona
    // membros/vinculos com status "ATIVO" sempre que um novo doc é criado
    // em `convites` para o email correspondente. Isso é um vetor de
    // reativação silenciosa: se alguém criar um convite para o email de
    // uma pessoa cujo acesso foi explicitamente revogado (ver
    // POST /api/admin/membros/revoke), este trigger reativaria o acesso
    // sem nenhuma ação administrativa explícita. Para evitar isso, quando
    // já existe um membro INATIVO para este condominioId, o trigger não
    // reprovisiona — reativação deve ser um ato admin explícito, não um
    // efeito colateral implícito de um novo convite.
    const existingMembrosSnap = await db
      .collection("condominios")
      .doc(convite.condominioId)
      .collection("membros")
      .where("email", "==", convite.email)
      .where("status", "==", "INATIVO")
      .limit(1)
      .get();

    if (!existingMembrosSnap.empty) {
      logger.info(
        `[onConviteCreated] Convite ignorado: membro já INATIVO (revogado) para email=${convite.email} ` +
        `condominioId=${convite.condominioId}. Reativação requer ação administrativa explícita.`
      );
      await snap.ref.update({
        status: "IGNORADO_MEMBRO_REVOGADO",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const tempPassword = generateTempPassword();

    const userRecord = await admin.auth().createUser({email: convite.email,
      password: tempPassword,
      displayName: convite.nome,
      emailVerified: false});

    const uid = userRecord.uid;

    await admin.auth().setCustomUserClaims(uid, {super_admin: false});

    const userDocRef = db.collection("userCondominios").doc(uid);
    const vinculoRef = userDocRef.collection("vinculos").doc(convite.condominioId);
    const membroRef = db.collection("condominios").doc(convite.condominioId)
      .collection("membros").doc(uid);

    const batch = db.batch();

    batch.set(userDocRef, {nome: convite.nome,
      email: convite.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()});

    batch.set(vinculoRef, {condominioId: convite.condominioId,
      role: convite.tipo,
      status: "ATIVO",
      createdAt: admin.firestore.FieldValue.serverTimestamp()});

    batch.set(membroRef, {nome: convite.nome,
      email: convite.email,
      role: convite.tipo,
      createdAt: admin.firestore.FieldValue.serverTimestamp()});

    batch.update(snap.ref, {status: "PROCESSADO",
      uidGerado: uid,
      senhaTemporaria: tempPassword,
      processedAt: admin.firestore.FieldValue.serverTimestamp()});

    await batch.commit();
  }
);


async function getUserTokens(uid: string): Promise<string[]> {
  const snap = await db.collection("users").doc(uid).collection("fcmTokens").get();
  return snap.docs.map((d) => String(d.id)).filter(Boolean);
}

async function notifyUser(uid: string, title: string, body: string, data?: Record<string, string>) {
  const tokens = await getUserTokens(uid);
  if (tokens.length === 0) return;

  const res = await admin.messaging().sendEachForMulticast({tokens,
    notification: {title, body},
    data: data || {}});

  // limpa tokens inválidos
  const invalid: string[] = [];
  res.responses.forEach((r, idx) => {
    if (!r.success) {
      const code = (r.error as any)?.code || "";
      if (String(code).includes("registration-token-not-registered") || String(code).includes("invalid-registration-token")) {
        invalid.push(tokens[idx]);
      }
    }
  });

  if (invalid.length > 0) {
    await Promise.all(
      invalid.map((t) => db.collection("users").doc(uid).collection("fcmTokens").doc(t).delete().catch(() => undefined))
    );
  }
}

// =============================================================
// NOTIFICAÇÕES (FCM) - THREAD/MENSAGEM MORADOR (v2 Triggers)
// =============================================================

/**
 * 1) Quando uma thread do tipo "MORADOR" é criada, notifica o morador alvo.
 */
export const onThreadCreated = onDocumentCreated(
  "condominios/{condId}/threads/{threadId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const thread = snap.data() as any;
    if (!thread) return;

    if (thread.tipo !== "MORADOR") return;

    const uid = thread?.alvo?.uid || thread?.alvo?.uidMorador;
    if (!uid) return;

    // evita duplicar
    if (thread.notifiedAt) return;

    await notifyUser(
      String(uid),
      "Nova mensagem do condomínio",
      "Você foi acionado. Abra a conversa para responder.",
      {url: "/anuncios",
        condominioId: String(event.params.condId),
        threadId: String(event.params.threadId)}
    );

    await snap.ref.set(
      {notifiedAt: admin.firestore.FieldValue.serverTimestamp()},
      {merge: true}
    );
  }
);

/**
 * 2) Quando uma mensagem é criada em uma thread do tipo "MORADOR", notifica o morador alvo.
 */
export const onMessageCreated = onDocumentCreated(
  "condominios/{condId}/threads/{threadId}/mensagens/{msgId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const msg = snap.data() as any;
    if (!msg) return;

    const threadRef = db.doc(`condominios/${event.params.condId}/threads/${event.params.threadId}`);
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) return;

    const thread = threadSnap.data() as any;
    if (!thread || thread.tipo !== "MORADOR") return;

    const uid = thread?.alvo?.uid || thread?.alvo?.uidMorador;
    if (!uid) return;

    // se o próprio morador enviou a mensagem, não notifica ele mesmo
    if (msg.createdByUid && String(msg.createdByUid) === String(uid)) return;

    const createdBy = msg.createdByNome ? String(msg.createdByNome) : "Admin";
    const text = msg.texto ? String(msg.texto) : "Nova mensagem";
    const body = (createdBy + ": " + text).slice(0, 140);

    await notifyUser(
      String(uid),
      "Nova mensagem do condomínio",
      body,
      {url: "/anuncios",
        condominioId: String(event.params.condId),
        threadId: String(event.params.threadId)}
    );
  }
);


/**
 * 3) Quando uma notificação é criada para um usuário, envia PUSH (FCM Web)
 * Path: condominios/{condId}/notificacoes/{notId}
 */
export const onNotificacaoCreated = onDocumentCreated(
  "condominios/{condId}/notificacoes/{notId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const n = snap.data() as any;
    if (!n) return;

    // evita duplicar
    if (n.pushSentAt || n.notifiedAt) return;

    const uid = n.targetUid || n.uid || n.userId;
    if (!uid) return;

    const title = String(n.title || n.titulo || "TreeCondo").slice(0, 80);
    const body = String(n.message || n.mensagem || "").slice(0, 180);

    const tipo = String(n.tipo || "");
    // rota padrão por tipo (ajuste se quiser)
    let url = String(n.url || "");
    if (!url) {
      if (tipo.startsWith("ENCOMENDA")) url = "/encomendas";
      else if (tipo.includes("ANUNCIO") || tipo.includes("AVISO")) url = "/anuncios";
      else url = "/painel";
    }

    try {
      await notifyUser(
        String(uid),
        title,
        body,
        {
          url,
          condominioId: String(event.params.condId),
          notificacaoId: String(event.params.notId),
          tipo,
        }
      );

      await snap.ref.set(
        { pushSentAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (e: any) {
      await snap.ref.set(
        {
          pushError: String(e?.message || e || "push_failed"),
          pushErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
);
