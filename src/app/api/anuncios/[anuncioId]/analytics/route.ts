/**
 * AN.4 — API DE ANALYTICS DE ANÚNCIO
 *
 * GET /api/anuncios/[anuncioId]/analytics?condominioId=...
 * Somente gestores.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(
  req: Request,
  ctx: { params: { anuncioId: string } }
) {
  try {
    const { anuncioId } = ctx.params;
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente.", 401);

    let decoded: any;
    try { decoded = await adminAuth().verifyIdToken(token); }
    catch { return jsonError("Token inválido.", 401); }

    const uid = decoded.uid;
    const db = adminDb();
    const membroSnap = await db.collection("condominios").doc(condominioId)
      .collection("membros").doc(uid).get();
    if (!membroSnap.exists) return jsonError("Não é membro.", 403);

    const role = String((membroSnap.data() || {}).role || "").toUpperCase();
    const isManager = (decoded as any)?.super_admin || ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role);
    if (!isManager) return jsonError("Sem permissão.", 403);

    // Get anuncio
    const anuncioSnap = await db.collection("condominios").doc(condominioId)
      .collection("anuncios").doc(anuncioId).get();
    if (!anuncioSnap.exists) return jsonError("Anúncio não encontrado.", 404);

    const anuncio = anuncioSnap.data() || {};

    // Count leituras
    const leiturasSnap = await db.collection("condominios").doc(condominioId)
      .collection("anuncios").doc(anuncioId)
      .collection("leituras").get();
    const readCount = leiturasSnap.size;

    // AN.4.1: Distinguish legacy (no audienceCount field) from new (audienceCount may be 0)
    const hasAudienceField = typeof anuncio.audienceCount === "number";
    const audienceCount = hasAudienceField ? Number(anuncio.audienceCount) : 0;
    const analyticsAvailable = hasAudienceField;
    const readRate = analyticsAvailable && audienceCount > 0
      ? Math.round((readCount / audienceCount) * 100) / 100
      : null;

    return NextResponse.json({
      ok: true,
      anuncioId,
      analyticsAvailable,
      eligibleRecipients: analyticsAvailable ? audienceCount : null,
      readRecipients: readCount,
      unreadRecipients: analyticsAvailable ? Math.max(0, audienceCount - readCount) : null,
      readRate,
      notificationSentAt: anuncio.notificationSentAt?.toDate?.()?.toISOString?.() || null,
      publishedAt: anuncio.publishedAt?.toDate?.()?.toISOString?.() || null,
      status: anuncio.status || "PUBLICADO",
    });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
