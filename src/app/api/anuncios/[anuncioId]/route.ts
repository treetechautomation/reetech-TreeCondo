/**
 * AN.2 — API DE ANÚNCIO INDIVIDUAL
 *
 * PUT /api/anuncios/[anuncioId] → editar / arquivar / restaurar
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { requiresExpiresAt, readDateFlexible } from "@/lib/anuncios/expiration";

export async function PUT(
  req: Request,
  ctx: { params: { anuncioId: string } }
) {
  try {
    const { anuncioId } = ctx.params;
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const authCtx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"],
    });

    const db = adminDb();
    const ref = db.collection("condominios").doc(condominioId).collection("anuncios").doc(anuncioId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Anúncio não encontrado.", 404);

    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp(), updatedByUid: authCtx.uid };

    // Action: archive
    if (body.action === "archive") {
      patch.status = "ARQUIVADO";
      patch.archivedAt = FieldValue.serverTimestamp();
      await ref.update(patch);
      return NextResponse.json({ ok: true, anuncioId, status: "ARQUIVADO" });
    }

    // Action: restore
    if (body.action === "restore") {
      const current = snap.data() || {};
      const now = new Date();
      let newStatus = "PUBLICADO";
      if (current.publishAt) {
        try {
          const pub = current.publishAt.toDate ? current.publishAt.toDate() : new Date(current.publishAt._seconds * 1000);
          if (pub > now) newStatus = "AGENDADO";
        } catch { /* keep PUBLICADO */ }
      }
      patch.status = newStatus;
      patch.archivedAt = null;
      await ref.update(patch);
      return NextResponse.json({ ok: true, anuncioId, status: newStatus });
    }

    // Edit fields
    if (body.titulo !== undefined) { const t = String(body.titulo).trim(); if (!t) return jsonError("titulo vazio", 400); patch.titulo = t; }
    if (body.mensagem !== undefined) { const m = String(body.mensagem).trim(); if (!m) return jsonError("mensagem vazia", 400); patch.mensagem = m; }

    if (body.targetScope !== undefined) {
      const scope = String(body.targetScope).toUpperCase();
      if (!["CONDOMINIO", "BLOCO"].includes(scope)) return jsonError("targetScope inválido", 400);
      patch.targetScope = scope;
      if (scope === "BLOCO" && body.targetBlocoId) {
        const blocoSnap = await db.collection("condominios").doc(condominioId).collection("blocos").doc(String(body.targetBlocoId)).get();
        if (!blocoSnap.exists) return jsonError("Bloco não encontrado.", 404);
        patch.targetBlocoId = String(body.targetBlocoId);
        patch.targetBlocoNome = String((blocoSnap.data() || {}).nome || body.targetBlocoId);
      } else if (scope === "CONDOMINIO") {
        patch.targetBlocoId = null;
        patch.targetBlocoNome = null;
      }
    }

    const currentData = snap.data() || {};
    const statusProvided = body.status !== undefined;
    const expiresAtProvided = body.expiresAt !== undefined;

    if (statusProvided) {
      const s = String(body.status).toUpperCase();
      if (!["RASCUNHO", "AGENDADO", "PUBLICADO"].includes(s)) return jsonError("status inválido", 400);
      patch.status = s;
      if (s === "PUBLICADO") patch.publishedAt = FieldValue.serverTimestamp();
      if (s === "AGENDADO" && !body.publishAt && !currentData.publishAt) return jsonError("publishAt obrigatório para AGENDADO", 400);
    }

    if (body.publishAt !== undefined) patch.publishAt = body.publishAt || null;

    // FEATURE.ANUNCIOS.1: expiração é obrigatória para publicar/agendar.
    // Só valida quando o pedido está explicitamente transicionando status
    // ou tocando expiresAt — uma edição que não mexe em nenhum dos dois
    // (ex.: corrigir o título de um anúncio legado já publicado) não é
    // retroativamente bloqueada por uma expiração que ele nunca teve.
    let expiresAtParsed: Date | null = null;
    if (expiresAtProvided) {
      if (body.expiresAt) {
        expiresAtParsed = readDateFlexible(body.expiresAt);
        if (!expiresAtParsed) return jsonError("Expiração inválida.", 400);
      }
      patch.expiresAt = expiresAtParsed ? Timestamp.fromDate(expiresAtParsed) : null;
      if (body.publishAt && expiresAtParsed && expiresAtParsed <= new Date(body.publishAt)) {
        return jsonError("expiresAt deve ser posterior a publishAt", 400);
      }
    }

    const effectiveStatus = statusProvided ? patch.status : String(currentData.status || "RASCUNHO").toUpperCase();
    if (requiresExpiresAt(effectiveStatus) && (statusProvided || expiresAtProvided)) {
      const effectiveExpiresAt = expiresAtProvided ? expiresAtParsed : readDateFlexible(currentData.expiresAt);
      if (!effectiveExpiresAt) return jsonError("Expiração é obrigatória para publicar ou agendar um anúncio.", 400);
    }
    if (expiresAtProvided && expiresAtParsed && requiresExpiresAt(effectiveStatus) && expiresAtParsed.getTime() <= Date.now()) {
      return jsonError("Expiração deve ser uma data futura.", 400);
    }

    await ref.update(patch);

    // AN.3: Send notifications if transitioning to PUBLICADO
    let notified = 0;
    if (patch.status === "PUBLICADO") {
      const current = snap.data() || {};
      if (!current.notificationSentAt) {
        try {
          const { sendAnnouncementNotifications, resolveAnnouncementRecipients } = await import("@/lib/notifications/anuncios");
          const scope = patch.targetScope || current.targetScope || "CONDOMINIO";
          const blocoIdParam = patch.targetBlocoId !== undefined ? (patch.targetBlocoId || null) : (current.targetBlocoId || null);
          const audienceCount = (await resolveAnnouncementRecipients(condominioId, scope, blocoIdParam)).length;
          const result = await sendAnnouncementNotifications(
            condominioId, anuncioId,
            patch.titulo || current.titulo || "",
            scope, blocoIdParam,
          );
          notified = result.notified;
          await ref.update({ notificationSentAt: FieldValue.serverTimestamp(), audienceCount });
        } catch (e: any) {
          console.error("[AN.3] Falha ao notificar PUT:", e?.message || e);
        }
      }
    }

    return NextResponse.json({ ok: true, anuncioId, notified });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
