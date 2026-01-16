import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";


if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Quando um membro é criado em:
 *   condominios/{condominioId}/membros/{uid}
 * Garante o vínculo em:
 *   userCondominios/{uid}/vinculos/{condominioId}
 * com ativo=true (necessário para as Rules: isVinculadoAtivo).
 */
export const onMembroCreated = onDocumentCreated(
  "condominios/{condominioId}/membros/{uid}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const {condominioId, uid} = event.params as {
      condominioId: string;
      uid: string;
    };

    const membro = snap.data() as Record<string, unknown>;

    // Só cria vínculo para membros ATIVOS (se quiser sempre, remova este if)
    const status = String(membro?.status || "").toUpperCase();
    if (status && status !== "ATIVO") return;

    const role = String(membro?.role || "MORADOR").toUpperCase();
    const email = membro?.email || null;
    const nome = membro?.nome || null;
    const blocoId = membro?.blocoId ?? null;
    const unidadeId = membro?.unidadeId ?? null;

    const vinculoRef = db
      .collection("userCondominios")
      .doc(uid)
      .collection("vinculos")
      .doc(condominioId);

    const now = admin.firestore.FieldValue.serverTimestamp();

    await vinculoRef.set(
      {
        uid,
        condominioId,
        role,
        status: status || "ATIVO",
        ativo: true,
        email,
        nome,
        blocoId,
        unidadeId,
        source: "onMembroCreated",
        createdAt: now,
        updatedAt: now,
      },
      {merge: true},
    );
  },
);
