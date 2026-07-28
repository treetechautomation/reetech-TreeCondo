/**
 * UN.6F — RESOLUÇÃO CANÔNICA DE DESTINATÁRIOS POR UNIDADE
 *
 * Source of truth: VinculoUnidade (condominios/{cid}/vinculosUnidades)
 * Substitui as 3 cópias de notifyUnidade em encomendas/create, retirar, retirar-lote.
 */

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export interface ResolvedRecipient {
  uid: string | null;
  pessoaId: string;
  hasAuth: boolean;
  hasActiveMembership: boolean;
  fcmTokens: string[];
}

export interface UnitRecipientsResult {
  recipients: ResolvedRecipient[];
  allUids: string[];
  uniqueUids: string[];
  totalResidents: number;
  totalWithAuth: number;
}

/**
 * Resolve destinatários de notificação para uma unidade canônica.
 *
 * @param condominioId - ID do condomínio
 * @param blocoId - ID do bloco (Firestore doc ID)
 * @param unitDocId - ID da unidade (Firestore doc ID)
 * @param opts.onlyResidents - Filtrar apenas resideNaUnidade=true (default true)
 * @param opts.requireActiveMembership - Exigir membro ATIVO (default true)
 * @param opts.excludeUids - UIDs a excluir
 */
export async function resolveUnitRecipients(
  condominioId: string,
  blocoId: string,
  unitDocId: string,
  opts: {
    onlyResidents?: boolean;
    requireActiveMembership?: boolean;
    excludeUids?: string[];
  } = {},
): Promise<UnitRecipientsResult> {
  const db = adminDb();
  const excludeSet = new Set(opts.excludeUids || []);
  const recipients: ResolvedRecipient[] = [];

  // Query VinculoUnidade for active residencies
  let q: FirebaseFirestore.Query = db
    .collection("condominios").doc(condominioId)
    .collection("vinculosUnidades")
    .where("unitDocId", "==", unitDocId)
    .where("blocoId", "==", blocoId)
    .where("status", "==", "ATIVO");

  if (opts.onlyResidents !== false) {
    q = q.where("resideNaUnidade", "==", true);
  }

  const vinculosSnap = await q.get();
  const pessoaIds = vinculosSnap.docs.map(d => d.data().pessoaId).filter(Boolean);

  if (pessoaIds.length === 0) {
    return { recipients: [], allUids: [], uniqueUids: [], totalResidents: 0, totalWithAuth: 0 };
  }

  // Batch fetch pessoas to resolve uids (pessoa.uid may be null for non-auth pessoas)
  const pessoaDocs = new Map<string, { uid: string | null }>();
  const pessoaChunks = chunk(pessoaIds, 30);

  for (const chunk of pessoaChunks) {
    const pessoaPromises = chunk.map(async (pid: string) => {
      const snap = await db.collection("condominios").doc(condominioId)
        .collection("pessoas").doc(pid).get();
      if (snap.exists) {
        pessoaDocs.set(pid, { uid: (snap.data() || {}).uid || null });
      }
    });
    await Promise.all(pessoaPromises);
  }

  // Collect all uids (deduplicated) that have Auth
  const seenUids = new Set<string>();
  for (const pid of pessoaIds) {
    const pessoa = pessoaDocs.get(pid);
    if (!pessoa) continue;
    const uid = pessoa.uid;
    if (uid && !excludeSet.has(uid) && !seenUids.has(uid)) {
      seenUids.add(uid);
      recipients.push({
        uid,
        pessoaId: pid,
        hasAuth: true,
        hasActiveMembership: false, // checked below
        fcmTokens: [],
      });
    } else if (!uid && !excludeSet.has(pid)) {
      // Pessoa without Auth — tracked as resident but cannot receive push
      recipients.push({
        uid: null,
        pessoaId: pid,
        hasAuth: false,
        hasActiveMembership: false,
        fcmTokens: [],
      });
    }
  }

  // Check Membership for auth users
  if (opts.requireActiveMembership !== false) {
    const membroChunks = chunk(recipients.filter(r => r.hasAuth && r.uid), 30);
    for (const chunk of membroChunks) {
      const membroPromises = chunk.map(async (r) => {
        const snap = await db.collection("condominios").doc(condominioId)
          .collection("membros").doc(r.uid!).get();
        if (snap.exists) {
          const md = snap.data() || {};
          r.hasActiveMembership = String(md.status || "").toUpperCase() === "ATIVO";
        }
      });
      await Promise.all(membroPromises);
    }
  }

  // Fetch FCM tokens for auth recipients with active membership
  const authRecipients = recipients.filter(r => r.hasAuth && r.hasActiveMembership);
  const uidChunks = chunk(authRecipients, 30);
  for (const chunk of uidChunks) {
    const tokenPromises = chunk.map(async (r) => {
      try {
        const tokensSnap = await db.collection("users").doc(r.uid!)
          .collection("fcmTokens").get();
        r.fcmTokens = tokensSnap.docs.map(d => d.id).filter(Boolean);
      } catch { r.fcmTokens = []; }
    });
    await Promise.all(tokenPromises);
  }

  const allUids = authRecipients.filter(r => r.fcmTokens.length > 0).map(r => r.uid!);
  const uniqueUids = [...new Set(allUids)];

  return {
    recipients,
    allUids,
    uniqueUids,
    totalResidents: recipients.filter(r => r.hasAuth || !r.hasAuth).length, // all = residents
    totalWithAuth: recipients.filter(r => r.hasAuth && r.hasActiveMembership).length,
  };
}

/**
 * Cria notificações in-app para os destinatários.
 */
export async function createInAppNotifications(
  condominioId: string,
  recipients: ResolvedRecipient[],
  notification: {
    tipo: string;
    title: string;
    message: string;
    encomendaId?: string;
    unidadeSnapshot?: { blocoNome?: string; unidadeNumero?: string };
  },
) {
  const db = adminDb();
  const targets = recipients.filter(r => r.hasAuth && r.hasActiveMembership);
  if (targets.length === 0) return;

  const batch = db.batch();
  const basePayload: Record<string, any> = {
    tipo: notification.tipo,
    title: notification.title,
    message: notification.message,
    titulo: notification.title,
    mensagem: notification.message,
    condominioId,
    lida: false,
    arquivada: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (notification.encomendaId) basePayload.encomendaId = notification.encomendaId;
  if (notification.unidadeSnapshot?.blocoNome) basePayload.blocoNome = notification.unidadeSnapshot.blocoNome;
  if (notification.unidadeSnapshot?.unidadeNumero) basePayload.unidadeNumero = notification.unidadeSnapshot.unidadeNumero;

  targets.forEach(r => {
    const ref = db.collection("condominios").doc(condominioId)
      .collection("notificacoes").doc();
    batch.set(ref, { ...basePayload, targetUid: r.uid }, { merge: true });
  });

  await batch.commit();
  console.log("[UN.6F] Notificações in-app criadas para", targets.length, "destinatários");
}

export interface LegacyUnitResolution {
  blocoId: string;
  unitDocId: string;
}

/**
 * Resolve unidade canônica a partir de texto legado (unidadeId + blocoId textuais).
 * Só retorna quando houver correspondência ÚNICA.
 */
export async function resolveCanonicalFromLegacy(
  condominioId: string,
  blocoIdText: string | null,
  unidadeIdText: string,
): Promise<LegacyUnitResolution | null> {
  if (!unidadeIdText) return null;
  const db = adminDb();
  const norm = String(unidadeIdText).toLowerCase()
    .replace(/\b(apto|apt|apartamento|unidade)\b/gi, "")
    .replace(/[^0-9a-z]/gi, "").trim()
    .replace(/^0+/, "") || "0";

  // Try exact match by blocoId if provided as doc ID
  if (blocoIdText) {
    // First try: blocoIdText is a Firestore doc ID
    const blocoSnap = await db.collection("condominios").doc(condominioId)
      .collection("blocos").doc(blocoIdText).get();
    if (blocoSnap.exists) {
      const snap = await db.collection("condominios").doc(condominioId)
        .collection("blocos").doc(blocoIdText).collection("unidades")
        .where("numeroNorm", "==", norm).where("ativo", "==", true).limit(2).get();
      if (snap.size === 1) {
        return { blocoId: blocoIdText, unitDocId: snap.docs[0].id };
      }
    }

    // Second try: blocoIdText is a bloco nome (normalized)
    const blocoNomeNorm = String(blocoIdText).toLowerCase().trim();
    const blocosSnap = await db.collection("condominios").doc(condominioId)
      .collection("blocos").where("ativo", "==", true).get();
    let foundUnit: string | null = null;
    let foundBloco: string | null = null;
    for (const bdoc of blocosSnap.docs) {
      const bd = bdoc.data() || {};
      const bnn = String(bd.nomeNorm || bd.blocoNomeNorm || "").toLowerCase().trim();
      if (bnn === blocoNomeNorm || bdoc.id === blocoIdText) {
        const snap = await db.collection("condominios").doc(condominioId)
          .collection("blocos").doc(bdoc.id).collection("unidades")
          .where("numeroNorm", "==", norm).where("ativo", "==", true).limit(2).get();
        if (snap.size === 1) {
          if (foundUnit) return null; // ambiguous
          foundUnit = snap.docs[0].id;
          foundBloco = bdoc.id;
        }
      }
    }
    if (foundUnit && foundBloco) return { blocoId: foundBloco, unitDocId: foundUnit };
  }

  // No bloco context: search all blocos for unique unit match
  const allBlocosSnap = await db.collection("condominios").doc(condominioId)
    .collection("blocos").where("ativo", "==", true).get();

  let matches: { blocoId: string; unitDocId: string }[] = [];
  for (const bdoc of allBlocosSnap.docs) {
    const snap = await db.collection("condominios").doc(condominioId)
      .collection("blocos").doc(bdoc.id).collection("unidades")
      .where("numeroNorm", "==", norm).where("ativo", "==", true).limit(2).get();
    snap.docs.forEach(d => matches.push({ blocoId: bdoc.id, unitDocId: d.id }));
  }
  if (matches.length === 1) return matches[0];
  return null; // 0 or >1 = ambiguous
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
