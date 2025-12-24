import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

function mustInit() {
  if (admin.apps.length === 0) admin.initializeApp();
  return admin.firestore();
}

/**
 * acceptInvite
 * - Requer usuário autenticado
 * - Lê convite pelo conviteId
 * - Confere se convite.email == request.auth.token.email
 * - Cria/atualiza:
 *   userCondominios/{uid}/vinculos/{condominioId}
 *   condominios/{condominioId}/blocos/{blocoId}/unidades/{unidadeId}/moradores/{uid} (opcional)
 * - Marca convite como usado
 */
export const acceptInvite = onCall({ region: "us-central1" }, async (req) => {
  const auth = req.auth;
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Faça login para aceitar o convite.");

  const email = (auth.token.email || "").toLowerCase();
  const conviteId = String(req.data?.conviteId || "").trim();
  if (!conviteId) throw new HttpsError("invalid-argument", "conviteId é obrigatório.");

  const db = mustInit();

  const conviteRef = db.collection("convites").doc(conviteId);
  const conviteSnap = await conviteRef.get();
  if (!conviteSnap.exists) throw new HttpsError("not-found", "Convite não encontrado.");

  const convite = conviteSnap.data() as any;

  const conviteEmail = String(convite?.email || "").toLowerCase();
  if (!conviteEmail || conviteEmail !== email) {
    throw new HttpsError(
      "permission-denied",
      "Este convite não pertence ao e-mail autenticado. Use o mesmo e-mail que recebeu o link."
    );
  }

  if (convite?.status === "USADO") {
    // Idempotente: se já aceito, só retorna os dados do vinculo
    return {
      ok: true,
      alreadyAccepted: true,
      condominioId: convite?.condominioId || null,
    };
  }

  const condominioId = String(convite?.condominioId || "").trim();
  const role = String(convite?.role || "MORADOR").trim();
  const status = String(convite?.statusVinculo || "ATIVO").trim();
  const blocoId = convite?.blocoId ? String(convite.blocoId) : null;
  const unidadeId = convite?.unidadeId ? String(convite.unidadeId) : null;

  if (!condominioId) throw new HttpsError("failed-precondition", "Convite sem condominioId.");

  const now = admin.firestore.FieldValue.serverTimestamp();

  // 1) Vinculo
  const vinculoRef = db
    .collection("userCondominios")
    .doc(auth.uid)
    .collection("vinculos")
    .doc(condominioId);

  // 2) (Opcional) Morador dentro da unidade
  const writes: Array<Promise<any>> = [];

  writes.push(
    vinculoRef.set(
      {
        condominioId,
        role, // "MORADOR" | ...
        status, // "ATIVO"
        blocoId,
        unidadeId,
        updatedAt: now,
        createdAt: convite?.createdAt || now,
        origem: "CONVITE_LINK_MAGICO",
        email: conviteEmail,
      },
      { merge: true }
    )
  );

  if (blocoId && unidadeId) {
    const moradorRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("blocos")
      .doc(blocoId)
      .collection("unidades")
      .doc(unidadeId)
      .collection("moradores")
      .doc(auth.uid);

    writes.push(
      moradorRef.set(
        {
          uid: auth.uid,
          email: conviteEmail,
          nome: convite?.nome || auth.token.name || "",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      )
    );
  }

  // 3) Marcar convite como usado
  writes.push(
    conviteRef.set(
      {
        status: "USADO",
        usedAt: now,
        usedByUid: auth.uid,
      },
      { merge: true }
    )
  );

  await Promise.all(writes);

  return {
    ok: true,
    alreadyAccepted: false,
    condominioId,
    role,
    status,
    blocoId,
    unidadeId,
  };
});
