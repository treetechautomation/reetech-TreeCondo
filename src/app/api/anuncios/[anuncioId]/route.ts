/**
 * AN.2 — API DE ANÚNCIO INDIVIDUAL
 *
 * PUT /api/anuncios/[anuncioId] → editar / arquivar / restaurar
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getAuth(req: Request, condominioId: string) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, error: "Token ausente.", status: 401 };
  let decoded: any;
  try { decoded = await adminAuth().verifyIdToken(token); }
  catch { return { ok: false, error: "Token inválido.", status: 401 }; }
  const uid = decoded.uid;
  const isSuper = decoded.super_admin === true || (decoded as any).superAdmin === true;
  if (isSuper) return { ok: true, uid, isSuper: true, role: "SUPER_ADMIN" };
  const db = adminDb();
  const membroSnap = await db.collection("condominios").doc(condominioId).collection("membros").doc(uid).get();
  if (!membroSnap.exists) return { ok: false, error: "Usuário não é membro.", status: 403 };
  const md = membroSnap.data() || {};
  if (String(md.status || "").toUpperCase() !== "ATIVO") return { ok: false, error: "Membership inativo.", status: 403 };
  const role = String(md.role || "").toUpperCase();
  return { ok: true, uid, isSuper: false, role };
}

const MANAGERS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function PUT(
  req: Request,
  ctx: { params: { anuncioId: string } }
) {
  try {
    const { anuncioId } = ctx.params;
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const auth = await getAuth(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);
    if (!auth.isSuper && !MANAGERS.includes(auth.role || "")) return jsonError("Sem permissão.", 403);

    const db = adminDb();
    const ref = db.collection("condominios").doc(condominioId).collection("anuncios").doc(anuncioId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Anúncio não encontrado.", 404);

    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp(), updatedByUid: auth.uid };

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
      // If it has a future publishAt, keep as AGENDADO
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

    if (body.status !== undefined) {
      const s = String(body.status).toUpperCase();
      if (!["RASCUNHO", "AGENDADO", "PUBLICADO"].includes(s)) return jsonError("status inválido", 400);
      patch.status = s;
      if (s === "PUBLICADO") patch.publishedAt = FieldValue.serverTimestamp();
      if (s === "AGENDADO" && !body.publishAt && !((snap.data() || {}).publishAt)) return jsonError("publishAt obrigatório para AGENDADO", 400);
    }

    if (body.publishAt !== undefined) patch.publishAt = body.publishAt || null;
    if (body.expiresAt !== undefined) {
      patch.expiresAt = body.expiresAt || null;
      if (body.publishAt && body.expiresAt && new Date(body.expiresAt) <= new Date(body.publishAt)) return jsonError("expiresAt deve ser posterior a publishAt", 400);
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
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
