/**
 * FEATURE.ANUNCIOS.1 — CRON: LIMPEZA DE ANEXO DE ANÚNCIO EXPIRADO
 *
 * POST /api/cron/anuncios/processar-expiracao
 *
 * Quando um anúncio expira, remove SOMENTE o binário anexado do Storage —
 * o documento Firestore do anúncio nunca é apagado por este processor
 * (histórico/auditoria preservados, mesmo padrão de "archive" já usado
 * pelo módulo). Idempotente: já não há mais nada para limpar (attachment
 * ausente, ou storagePath já nulo de uma execução anterior) é um no-op,
 * não um erro.
 *
 * Reaproveita exatamente o mesmo mecanismo de auth do cron irmão
 * (/api/cron/anuncios/processar-agendados): header x-cron-secret ==
 * CRON_RESERVAS_SECRET, fail-closed se a env não estiver configurada.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { readDateFlexible } from "@/lib/anuncios/expiration";

export async function POST(req: Request) {
  try {
    const cronSecret = process.env.CRON_RESERVAS_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ ok: false, error: "Serviço não configurado." }, { status: 503 });
    }
    const headerSecret = req.headers.get("x-cron-secret") || "";
    if (headerSecret !== cronSecret) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }

    const db = adminDb();
    const now = new Date();
    let scanned = 0;
    let deleted = 0;
    let skippedNoAttachment = 0;
    let failed = 0;

    const condosSnap = await db.collection("condominios").get();

    for (const condoDoc of condosSnap.docs) {
      const condominioId = condoDoc.id;
      const anunciosSnap = await db.collection("condominios").doc(condominioId).collection("anuncios").get();

      for (const doc of anunciosSnap.docs) {
        const data = doc.data() || {};
        scanned++;

        const storagePath: string | null = data.attachment?.storagePath || null;
        if (!storagePath) { skippedNoAttachment++; continue; } // idempotente: já limpo ou nunca teve anexo

        const expiresAt = readDateFlexible(data.expiresAt);
        if (!expiresAt || expiresAt > now) continue; // não expirado ainda

        try {
          await adminStorage().file(storagePath).delete({ ignoreNotFound: true });
        } catch (e: any) {
          // Não marca como limpo se o delete do Storage falhou por motivo
          // real (não "not found") — próxima execução tenta de novo.
          failed++;
          console.error("[FEATURE.ANUNCIOS.1] Falha ao limpar anexo expirado:", condominioId, doc.id, storagePath, e?.message);
          continue;
        }

        await doc.ref.update({
          "attachment.storagePath": null,
          "attachment.removedAt": FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        deleted++;
      }
    }

    return NextResponse.json({ ok: true, scanned, deleted, skippedNoAttachment, failed, timestamp: now.toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erro inesperado" }, { status: 500 });
  }
}
