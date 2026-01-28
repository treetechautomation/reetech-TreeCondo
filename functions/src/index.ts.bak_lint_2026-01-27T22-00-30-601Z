/* eslint-disable require-jsdoc, max-len */
import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

// Triggers
import { onMembroCreated } from "./triggers/onMembroCreated";
export { onMembroCreated };

// Callables
export { acceptInvite } from "./callables/acceptInvite";
export { adminCreateMorador } from "./callables/adminCreateMorador";
export { adminCreateMembro } from "./callables/adminCreateMembro";

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

    const convite = snap.data() as {
      nome: string;
      email: string;
      condominioId: string;
      tipo: string;
      status?: string;
    };

    if (convite.status === "PROCESSADO") return;

    const tempPassword = generateTempPassword();

    const userRecord = await admin.auth().createUser({
      email: convite.email,
      password: tempPassword,
      displayName: convite.nome,
      emailVerified: false,
    });

    const uid = userRecord.uid;

    await admin.auth().setCustomUserClaims(uid, { super_admin: false });

    const userDocRef = db.collection("userCondominios").doc(uid);
    const vinculoRef = userDocRef.collection("vinculos").doc(convite.condominioId);
    const membroRef = db.collection("condominios").doc(convite.condominioId)
      .collection("membros").doc(uid);

    const batch = db.batch();

    batch.set(userDocRef, {
      nome: convite.nome,
      email: convite.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.set(vinculoRef, {
      condominioId: convite.condominioId,
      role: convite.tipo,
      status: "ATIVO",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.set(membroRef, {
      nome: convite.nome,
      email: convite.email,
      role: convite.tipo,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(snap.ref, {
      status: "PROCESSADO",
      uidGerado: uid,
      senhaTemporaria: tempPassword,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: data || {},
  });

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
      {
        url: "/anuncios",
        condominioId: String(event.params.condId),
        threadId: String(event.params.threadId),
      }
    );

    await snap.ref.set(
      { notifiedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
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
      {
        url: "/anuncios",
        condominioId: String(event.params.condId),
        threadId: String(event.params.threadId),
      }
    );
  }
);
