/**
 * F.2.5 — ELIGIBLE LINKS (server-side)
 *
 * GET /api/onboarding/eligible-links
 *
 * Descobre vínculos elegíveis para o email autenticado e verificado.
 * Retorna dados mínimos (sem PII). Nunca permite enumeração.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rateLimiter";
import { sanitizeOnboardingLog } from "@/lib/onboarding/service";
import { normEmail } from "@/lib/onboarding/service";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente.", 401);

    let decoded: any;
    try {
      decoded = await aauth.verifyIdToken(token);
    } catch {
      return jsonError("Token inválido ou expirado.", 401);
    }

    const uid = decoded.uid as string;

    const rate = checkRateLimit({ key: rateLimitKey(uid, null, "eligible-links"), limit: 10, windowSec: 60 });
    if (!rate.allowed) return rateLimitResponse(rate);

    const authUser = await aauth.getUser(uid);
    if (!authUser.emailVerified) {
      return jsonError("EMAIL_NOT_VERIFIED. Verifique seu e-mail antes de buscar vínculos.", 403);
    }

    const authEmail = normEmail(authUser.email);
    if (!authEmail) {
      return jsonError("Conta sem e-mail associado.", 400);
    }

    const accessLinksSnap = await db
      .collectionGroup("accessLinks")
      .where("emailNorm", "==", authEmail)
      .where("accessStatus", "==", "PENDENTE_VINCULO")
      .get();

    const links: {
      linkId: string;
      condominioNome: string;
      blocoNome: string;
      unidadeNumero: string;
      tipoVinculo: string;
    }[] = [];

    for (const doc of accessLinksSnap.docs) {
      const data = doc.data();

      if (data.claimedByUid) continue;

      links.push({
        linkId: doc.id,
        condominioNome: String(data.condominioNome || ""),
        blocoNome: String(data.blocoNome || ""),
        unidadeNumero: String(data.unidadeNumero || ""),
        tipoVinculo: String(data.tipoVinculo || "PROPRIETARIO"),
      });
    }

    console.log("[onboarding/eligible-links]", JSON.stringify(sanitizeOnboardingLog({
      operation: "SELF_ONBOARDING_SEARCH",
      uid,
      matches: links.length,
    })));

    return NextResponse.json({ ok: true, links });
  } catch (err: any) {
    console.error("[onboarding/eligible-links] Erro:", err?.message);
    return jsonError("Erro inesperado", 500);
  }
}
