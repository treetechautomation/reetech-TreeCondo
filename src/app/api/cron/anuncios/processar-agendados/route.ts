/**
 * AN.3 — CRON: PROCESSAR ANÚNCIOS AGENDADOS
 *
 * POST /api/cron/anuncios/processar-agendados
 * Chamado periodicamente para publicar anúncios agendados e enviar notificações.
 *
 * FIX.ANUNCIOS.2A (ver src/lib/anuncios/scheduling.ts para o contrato
 * completo): esta rota foi endurecida em duas frentes.
 *
 * 1. Elegibilidade nunca mais assume "vencido" por acidente. `publishAt`
 *    ausente/inválido é sempre SKIP + log de aviso — nunca publicação
 *    silenciosa. `readDateFlexible` (tolerante a Timestamp real, ao
 *    `{_seconds}` serializado e a strings ISO legadas) substitui o
 *    parsing inline frágil que produzia `Invalid Date` para o formato
 *    gravado por versões anteriores da rota de criação/edição.
 *
 * 2. A transição AGENDADO -> PUBLICADO e a reivindicação do direito de
 *    notificar acontecem dentro de uma `runTransaction` do Firestore.
 *    Duas execuções concorrentes que leem o mesmo documento antes de
 *    qualquer uma commitar terão uma delas automaticamente reexecutada
 *    pelo Firestore (controle de concorrência otimista) — na
 *    reexecução, o documento já não satisfaz mais a condição de
 *    elegibilidade/reivindicação, então a segunda execução não publica
 *    nem notifica de novo. Uma reivindicação (`notificationStatus:
 *    "PENDING"`) mais antiga que `NOTIFICATION_CLAIM_STALE_MS` é
 *    considerada travada (processo morreu entre reivindicar e enviar) e
 *    pode ser reivindicada de novo por uma execução futura — coberto por
 *    uma segunda passada, mais barata, sobre `notificationStatus ==
 *    "PENDING"` (índice de campo único, não precisa de composite index).
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore, Transaction, DocumentReference } from "firebase-admin/firestore";
import { sendAnnouncementNotifications, resolveAnnouncementRecipients } from "@/lib/notifications/anuncios";
import { readDateFlexible } from "@/lib/anuncios/expiration";
import { evaluateSchedulingEligibility, canClaimNotification, NOTIFICATION_CLAIM_STALE_MS } from "@/lib/anuncios/scheduling";

type ClaimResult =
  | { action: "skip"; reason: string }
  | { action: "claimed"; publishTransitioned: boolean; titulo: string; targetScope: string; targetBlocoId: string | null }
  | { action: "published_only" };

/**
 * Transação atômica: decide e aplica, num único commit, se este
 * documento deve transicionar para PUBLICADO e/ou se esta execução
 * reivindica o direito de enviar a notificação. Nunca envia a
 * notificação em si (isso acontece fora da transação, depois).
 */
async function claimAnuncio(
  db: Firestore,
  ref: DocumentReference,
  now: Date,
): Promise<ClaimResult> {
  return db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { action: "skip", reason: "not_found" };
    const data = snap.data() || {};

    const status = String(data.status || "");
    let publishTransitioned = false;

    if (status === "AGENDADO") {
      const publishAtDate = readDateFlexible(data.publishAt);
      const eligibility = evaluateSchedulingEligibility(status, publishAtDate, now);
      if (!eligibility.eligible) return { action: "skip", reason: eligibility.reason };
      publishTransitioned = true;
    } else if (status !== "PUBLICADO") {
      // RASCUNHO/ARQUIVADO nunca são tocados por este job.
      return { action: "skip", reason: "not_eligible_status" };
    }

    const notificationStatus: string | null = data.notificationStatus || null;
    const claimedAt = data.notificationClaimedAt?.toDate ? data.notificationClaimedAt.toDate() : null;
    const claimable = canClaimNotification(notificationStatus, claimedAt, now, NOTIFICATION_CLAIM_STALE_MS);

    if (!publishTransitioned && !claimable) {
      return { action: "skip", reason: "already_handled" };
    }

    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    if (publishTransitioned) {
      patch.status = "PUBLICADO";
      patch.publishedAt = FieldValue.serverTimestamp();
    }
    if (claimable) {
      patch.notificationStatus = "PENDING";
      patch.notificationClaimedAt = FieldValue.serverTimestamp();
    }
    tx.update(ref, patch);

    if (!claimable) return { action: "published_only" };

    return {
      action: "claimed",
      publishTransitioned,
      titulo: String(data.titulo || ""),
      targetScope: String(data.targetScope || "CONDOMINIO"),
      targetBlocoId: data.targetBlocoId || null,
    };
  });
}

async function sendClaimedNotification(
  ref: DocumentReference,
  condominioId: string,
  anuncioId: string,
  claim: Extract<ClaimResult, { action: "claimed" }>,
): Promise<{ ok: true; notified: number } | { ok: false }> {
  try {
    const audienceCount = (await resolveAnnouncementRecipients(
      condominioId, claim.targetScope, claim.targetBlocoId,
    )).length;
    const result = await sendAnnouncementNotifications(
      condominioId, anuncioId, claim.titulo, claim.targetScope, claim.targetBlocoId,
    );
    await ref.update({
      notificationStatus: "SENT",
      notificationSentAt: FieldValue.serverTimestamp(),
      audienceCount,
    });
    return { ok: true, notified: result.notified };
  } catch (e: any) {
    console.error("[AN.3] Falha ao notificar anúncio", anuncioId, "-", e?.message || e);
    try {
      await ref.update({ notificationStatus: "FAILED" });
    } catch { /* melhor esforço — próxima execução tenta de novo mesmo sem essa gravação */ }
    return { ok: false };
  }
}

export async function POST(req: Request) {
  const runStartedAt = Date.now();
  try {
    // ---- S0.4: Autenticação obrigatória via cron secret ----
    const cronSecret = process.env.CRON_RESERVAS_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { ok: false, error: "Serviço não configurado." },
        { status: 503 },
      );
    }

    const headerSecret = req.headers.get("x-cron-secret") || "";
    if (headerSecret !== cronSecret) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado." },
        { status: 401 },
      );
    }

    const db = adminDb();
    const now = new Date();

    let published = 0;
    let notified = 0;
    let skippedFuture = 0;
    let skippedInvalid = 0;
    let skippedOther = 0;
    let failed = 0;
    let recovered = 0;

    const condosSnap = await db.collection("condominios").get();

    for (const condoDoc of condosSnap.docs) {
      const condominioId = condoDoc.id;
      const anunciosRef = db.collection("condominios").doc(condominioId).collection("anuncios");

      // Passada 1 — recuperação: reivindicações de notificação travadas
      // (processo morreu entre reivindicar e enviar, em qualquer
      // execução anterior). Consulta de campo único, não exige
      // composite index.
      const pendingSnap = await anunciosRef.where("notificationStatus", "==", "PENDING").get();
      for (const doc of pendingSnap.docs) {
        const claim = await claimAnuncio(db, doc.ref, now);
        if (claim.action === "claimed") {
          const sendResult = await sendClaimedNotification(doc.ref, condominioId, doc.id, claim);
          if (sendResult.ok) { recovered++; notified += sendResult.notified; }
          else failed++;
        }
        // "skip" aqui é o caso comum (reivindicação ainda fresca, de
        // outra execução em andamento) — não é um erro, não é contado.
      }

      // Passada 2 — publicação de agendados vencidos.
      const anunciosSnap = await anunciosRef.where("status", "==", "AGENDADO").get();
      for (const doc of anunciosSnap.docs) {
        const claim = await claimAnuncio(db, doc.ref, now);

        if (claim.action === "skip") {
          if (claim.reason === "future") skippedFuture++;
          else if (claim.reason === "invalid_publish_at") {
            skippedInvalid++;
            console.warn("[AN.3] publishAt ausente/inválido, publicação automática recusada:", condominioId, doc.id);
          } else {
            skippedOther++;
          }
          continue;
        }

        if (claim.action === "claimed" || claim.action === "published_only") {
          if (claim.action === "claimed" && claim.publishTransitioned) published++;
          else if (claim.action === "published_only") published++;
        }

        if (claim.action === "claimed") {
          const sendResult = await sendClaimedNotification(doc.ref, condominioId, doc.id, claim);
          if (sendResult.ok) notified += sendResult.notified;
          else failed++;
        }
      }
    }

    const durationMs = Date.now() - runStartedAt;
    console.log(
      "[AN.3] run concluído",
      JSON.stringify({ published, notified, recovered, skippedFuture, skippedInvalid, skippedOther, failed, durationMs }),
    );

    return NextResponse.json({
      ok: true,
      published, notified, recovered,
      skippedFuture, skippedInvalid, skippedOther, failed,
      timestamp: now.toISOString(),
    });
  } catch (e: any) {
    console.error("[AN.3] run falhou:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro inesperado" }, { status: 500 });
  }
}
