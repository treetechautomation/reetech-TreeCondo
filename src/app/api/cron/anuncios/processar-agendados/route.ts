/**
 * AN.3 — CRON: PROCESSAR ANÚNCIOS AGENDADOS
 *
 * POST /api/cron/anuncios/processar-agendados
 * Chamado periodicamente para publicar anúncios agendados e enviar notificações.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { sendAnnouncementNotifications, resolveAnnouncementRecipients } from "@/lib/notifications/anuncios";

export async function POST(req: Request) {
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
    let processed = 0;
    let notified = 0;

    // Find all AGENDADO announcements where publishAt <= now
    const condosSnap = await db.collection("condominios").get();

    for (const condoDoc of condosSnap.docs) {
      const condominioId = condoDoc.id;

      const anunciosSnap = await db.collection("condominios").doc(condominioId)
        .collection("anuncios")
        .where("status", "==", "AGENDADO")
        .get();

      for (const doc of anunciosSnap.docs) {
        const data = doc.data() || {};
        if (!data.publishAt) continue;

        let pubDate: Date;
        try {
          pubDate = data.publishAt.toDate ? data.publishAt.toDate() : new Date(data.publishAt._seconds * 1000);
        } catch { continue; }

        if (pubDate > now) continue;

        // Publish the announcement
        await doc.ref.update({
          status: "PUBLICADO",
          publishedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        processed++;

        // Send notifications (only once)
        if (!data.notificationSentAt) {
          try {
            const audienceCount = (await resolveAnnouncementRecipients(
              condominioId,
              data.targetScope || "CONDOMINIO",
              data.targetBlocoId || null,
            )).length;
            const result = await sendAnnouncementNotifications(
              condominioId, doc.id,
              data.titulo || "",
              data.targetScope || "CONDOMINIO",
              data.targetBlocoId || null,
            );
            notified += result.notified;
            await doc.ref.update({ notificationSentAt: FieldValue.serverTimestamp(), audienceCount });
          } catch (e: any) {
            console.error("[AN.3] Falha ao notificar agendado:", doc.id, e?.message);
          }
        } else {
          // Already notified previously, just publish
          await doc.ref.update({ publishedAt: FieldValue.serverTimestamp() });
        }
      }
    }

    return NextResponse.json({ ok: true, processed, notified, timestamp: now.toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erro inesperado" }, { status: 500 });
  }
}
