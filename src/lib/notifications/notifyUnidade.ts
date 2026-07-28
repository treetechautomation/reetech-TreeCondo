/**
 * UN.6F — NOTIFY UNIDADE (implementação canônica unificada)
 *
 * Substitui as 3 cópias duplicadas em encomendas/create, retirar, retirar-lote.
 * Usa VinculoUnidade como source of truth, com fallback legado seguro.
 */

import { resolveUnitRecipients, createInAppNotifications, resolveCanonicalFromLegacy, type ResolvedRecipient, type LegacyUnitResolution } from "./unitRecipients";
import { normUnidade, normBloco } from "@/lib/normalization/location";

interface NotifyParams {
  condominioId: string;
  unidadeId: string;
  blocoId?: string | null;
  encomendaId: string;
  transportadora?: string | null;
  codigo?: string | null;
}

/**
 * Versão unificada de notifyUnidade.
 * Tenta resolver via VinculoUnidade (canônico).
 * Se não encontrar, faz fallback para query legada de membros/{uid}.
 */
export async function notifyUnidade(db: any, params: NotifyParams) {
  const condId = params.condominioId;
  const unidadeId = String(params.unidadeId || "").trim();
  if (!condId || !unidadeId) return;

  // Try canonical resolution
  let canon: LegacyUnitResolution | null = null;
  try {
    canon = await resolveCanonicalFromLegacy(condId, params.blocoId ?? null, unidadeId);
  } catch { /* ignore */ }

  if (canon) {
    // Canonical path: use VinculoUnidade
    const result = await resolveUnitRecipients(condId, canon.blocoId, canon.unitDocId, {
      onlyResidents: true,
      requireActiveMembership: true,
    });

    if (result.uniqueUids.length === 0 && result.totalResidents === 0) {
      console.log("[UN.6F] Nenhum residente encontrado via VinculoUnidade para unidade:", unidadeId);
      return;
    }

    await createInAppNotifications(condId, result.recipients, {
      tipo: "ENCOMENDA_CHEGOU",
      title: "📦 Encomenda chegou",
      message: `Sua encomenda${params.transportadora ? ` (${params.transportadora})` : ""} chegou. Retire na portaria.`,
      encomendaId: params.encomendaId,
      unidadeSnapshot: { blocoNome: undefined, unidadeNumero: unidadeId },
    });

    console.log("[UN.6F] Notificações (canônico) para", result.totalWithAuth, "residentes com Auth da unidade", unidadeId);
    return;
  }

  // Legacy fallback: query membros by unidadeIdNorm + blocoIdNorm
  const alvoUn = normUnidade(unidadeId);
  const alvoBl = (params.blocoId ?? null) ? normBloco(params.blocoId) : null;

  const membrosRef = db.collection("condominios").doc(condId).collection("membros");
  let q = membrosRef.where("unidadeIdNorm", "==", alvoUn);
  if (alvoBl) q = q.where("blocoIdNorm", "==", alvoBl);
  const snap = await q.get();

  const membros = snap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((m: any) => {
      const st = String(m.status || "").toUpperCase();
      return st === "ATIVO" || st === "PENDENTE";
    });

  if (membros.length === 0) {
    console.log("[UN.6F] Nenhum morador (legado) encontrado para unidade:", unidadeId);
    return;
  }

  const batch = db.batch();
  membros.forEach((m: any) => {
    const uid = m.id;
    const ref = db.collection("condominios").doc(condId).collection("notificacoes").doc();
    const transp = params.transportadora ? ` (${params.transportadora})` : "";
    batch.set(ref, {
      tipo: "ENCOMENDA_CHEGOU",
      title: "📦 Encomenda chegou",
      message: `Sua encomenda${transp} chegou. Retire na portaria.`,
      titulo: "📦 Encomenda chegou",
      mensagem: `Sua encomenda${transp} chegou. Retire na portaria.`,
      targetUid: uid,
      condominioId: condId,
      encomendaId: params.encomendaId,
      unidadeId: params.unidadeId,
      blocoId: params.blocoId ?? null,
      lida: false,
      arquivada: false,
      createdAt: db.FieldValue?.serverTimestamp() || new Date(),
      updatedAt: db.FieldValue?.serverTimestamp() || new Date(),
    }, { merge: true });
  });
  await batch.commit();
  console.log("[UN.6F] Notificações (legado) para", membros.length, "moradores da unidade", unidadeId);
}
