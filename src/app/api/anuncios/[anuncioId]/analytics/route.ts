/**
 * AN.4 — API DE ANALYTICS DE ANÚNCIO
 *
 * GET /api/anuncios/[anuncioId]/analytics?condominioId=...
 * Somente gestores.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function GET(
  req: Request,
  ctx: { params: { anuncioId: string } }
) {
  try {
    const { anuncioId } = ctx.params;
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"],
    });

    const db = adminDb();

    const anuncioSnap = await db.collection("condominios").doc(condominioId)
      .collection("anuncios").doc(anuncioId).get();
    if (!anuncioSnap.exists) return jsonError("Anúncio não encontrado.", 404);

    const anuncio = anuncioSnap.data() || {};

    const leiturasSnap = await db.collection("condominios").doc(condominioId)
      .collection("anuncios").doc(anuncioId)
      .collection("leituras").get();
    const readCount = leiturasSnap.size;

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
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
