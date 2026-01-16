import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Resend } from "resend";

admin.initializeApp();
const db = admin.firestore();

/**
 * Payload esperado:
 * {
 *   condominioId: string,
 *   blocoId?: string,
 *   unidadeId: string,     // ID da unidade (docId)
 *   email: string,
 *   nome: string,
 *   role?: "MORADOR" | "PORTEIRO" | "SINDICO" | "ADMIN"
 * }
 */
export const adminCreateMorador = onCall({ region: "us-central1" }, async (req) => {
  const caller = req.auth;
  if (!caller) throw new HttpsError("unauthenticated", "Precisa estar logado.");

  // Só super admin pode usar (claim) — adapte se quiser permitir síndico também
  const isSuper =
    (caller.token as any)?.super_admin === true ||
    (caller.token as any)?.email === "treecommunity@treetechautomation.com";

  if (!isSuper) throw new HttpsError("permission-denied", "Somente SUPER ADMIN.");

  const body = (req.data || {}) as any;
  const condominioId = String(body.condominioId || "").trim();
  const blocoId = body.blocoId ? String(body.blocoId).trim() : null;
  const unidadeId = String(body.unidadeId || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const nome = String(body.nome || "").trim();
  const role = (body.role ? String(body.role) : "MORADOR").toUpperCase();

  if (!condominioId || !unidadeId || !email || !nome) {
    throw new HttpsError("invalid-argument", "Campos obrigatórios: condominioId, unidadeId, email, nome.");
  }

  // 1) garante usuário no Auth
  let user: admin.auth.UserRecord | null = null;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (e: any) {
    if (e?.code === "auth/user-not-found") {
      user = await admin.auth().createUser({
        email,
        displayName: nome,
        emailVerified: false,
        disabled: false,
      });
    } else {
      throw new HttpsError("internal", "Erro ao consultar/criar usuário.", e?.message);
    }
  }

  const uid = user.uid;

  // 2) grava vínculo + membro
  const userDocRef = db.collection("userCondominios").doc(uid);
  const vinculoRef = userDocRef.collection("vinculos").doc(condominioId);
  const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);

  const batch = db.batch();

  batch.set(
    userDocRef,
    {
      nome,
      email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    vinculoRef,
    {
      condominioId,
      blocoId: blocoId,
      unidadeId,
      role: role, // MORADOR default
      status: "ATIVO",
      email,
      nome,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    membroRef,
    {
      nome,
      email,
      role: role,
      status: "ATIVO",
      unidadeId,
      blocoId: blocoId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // 3) gera LINK MÁGICO (Admin SDK)
  const continueUrl = "https://treecondo.app/login";
  const actionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  const magicLink = await admin.auth().generateSignInWithEmailLink(email, actionCodeSettings);

  // 4) envia e-mail via Resend (secret)
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new HttpsError(
      "failed-precondition",
      "Faltou RESEND_API_KEY nas secrets/env. Configure antes de usar."
    );
  }

  const resend = new Resend(resendKey);

  // IMPORTANTÍSSIMO: use um sender já validado no Resend
  const from = process.env.RESEND_FROM || "TreeCondo <no-reply@treetechautomation.com>";

  await resend.emails.send({
    from,
    to: [email],
    subject: "TreeCondo — Primeiro acesso",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Olá, ${nome}!</h2>
        <p>Seu primeiro acesso ao <b>TreeCondo</b> está pronto.</p>
        <p>Clique no botão abaixo para entrar com link mágico:</p>
        <p>
          <a href="${magicLink}" style="display:inline-block;padding:12px 16px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px">
            Acessar TreeCondo
          </a>
        </p>
        <p>Após entrar, você poderá criar sua senha para os próximos logins.</p>
        <p style="color:#666;font-size:12px">Se você não solicitou este acesso, ignore este e-mail.</p>
      </div>
    `,
  });

  // 5) salva o link no doc (opcional)
  batch.set(
    vinculoRef,
    {
      firstAccessLink: magicLink,
      firstAccessSentAt: admin.firestore.FieldValue.serverTimestamp(),
      authUid: uid,
    },
    { merge: true }
  );

  await batch.commit();

  return {
    ok: true,
    uid,
    email,
    condominioId,
    unidadeId,
    blocoId,
    role,
  };
});
