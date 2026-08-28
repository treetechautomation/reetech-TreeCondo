/**
 * AN.3 — NOTIFICATION HELPERS FOR ANNOUNCEMENTS
 */
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Resolve destinatários para um anúncio.
 * CONDOMINIO: todos membros ATIVOS.
 * BLOCO: residentes do bloco (VinculoUnidade) + operadores.
 */
export async function resolveAnnouncementRecipients(
  condominioId: string,
  targetScope: string,
  targetBlocoId: string | null,
): Promise<string[]> {
  const db = adminDb();
  const uids = new Set<string>();

  // Get all active members
  const membrosSnap = await db.collection("condominios").doc(condominioId)
    .collection("membros").where("status", "==", "ATIVO").get();

  if (targetScope === "CONDOMINIO") {
    // All active members
    membrosSnap.docs.forEach(d => uids.add(d.id));
  } else if (targetScope === "BLOCO" && targetBlocoId) {
    // Find residents of the specific bloco via VinculoUnidade
    const vincSnap = await db.collection("condominios").doc(condominioId)
      .collection("vinculosUnidades")
      .where("blocoId", "==", targetBlocoId)
      .where("status", "==", "ATIVO")
      .where("resideNaUnidade", "==", true)
      .get();

    const pessoaIds = [...new Set(vincSnap.docs.map(d => d.data().pessoaId).filter(Boolean))];

    // Resolve pessoas to uids
    for (const pid of pessoaIds) {
      try {
        const pSnap = await db.collection("condominios").doc(condominioId)
          .collection("pessoas").doc(pid).get();
        if (pSnap.exists && (pSnap.data() || {}).uid) {
          uids.add(String((pSnap.data() || {}).uid));
        }
      } catch { /* ignore */ }
    }

    // Legacy fallback: membros with matching blocoId
    membrosSnap.docs.forEach(d => {
      const md = d.data() || {};
      if (String(md.blocoId || "") === targetBlocoId) uids.add(d.id);
    });

    // Also include operators (SINDICO, ADMIN, etc.)
    membrosSnap.docs.forEach(d => {
      const md = d.data() || {};
      const role = String(md.role || "").toUpperCase();
      if (["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role)) {
        uids.add(d.id);
      }
    });
  }

  return [...uids];
}

/**
 * Cria notificações in-app para um anúncio publicado.
 *
 * FIX.ANUNCIOS.2A: o ID do documento de notificação é determinístico
 * (`anuncio_{anuncioId}_{uid}`), não mais um ID aleatório. Isso torna a
 * função idempotente por construção: reenviar para o mesmo anúncio (ex.:
 * uma execução de cron que reivindica uma notificação travada após um
 * crash, ver src/lib/anuncios/scheduling.ts) sobrescreve o mesmo
 * documento (`{merge:true}`) em vez de criar um duplicado — mesmo que o
 * mecanismo de reivindicação a montante falhe em prevenir uma segunda
 * tentativa, o morador nunca recebe dois registros de notificação
 * separados para o mesmo anúncio.
 */
export async function sendAnnouncementNotifications(
  condominioId: string,
  anuncioId: string,
  titulo: string,
  targetScope: string,
  targetBlocoId: string | null,
) {
  const db = adminDb();
  const uids = await resolveAnnouncementRecipients(condominioId, targetScope, targetBlocoId);
  if (uids.length === 0) return { notified: 0 };

  const batch = db.batch();
  uids.forEach(uid => {
    const ref = db.collection("condominios").doc(condominioId)
      .collection("notificacoes").doc(`anuncio_${anuncioId}_${uid}`);
    batch.set(ref, {
      tipo: "ANUNCIO_PUBLICADO",
      title: "Novo anúncio",
      message: titulo,
      titulo: "Novo anúncio",
      mensagem: titulo,
      targetUid: uid,
      condominioId,
      anuncioId,
      lida: false,
      arquivada: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();
  console.log("[AN.3] Notificações enviadas para", uids.length, "destinatários");
  return { notified: uids.length };
}
