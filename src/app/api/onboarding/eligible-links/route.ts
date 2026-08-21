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
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { sanitizeOnboardingLog, normEmail } from "@/lib/onboarding/service";

export async function GET(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    // UNIT A reconciliation — auth/rate-limit consolidated via apiGuard.
    const ctx = await apiGuard({
      request: req,
      requireAuth: true,
      rateLimit: { limit: 10, windowSec: 60 },
    });

    const authUser = await aauth.getUser(ctx.uid);
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
      condominioId: string;
      condominioNome: string;
      blocoNome: string;
      unidadeNumero: string;
      tipoVinculo: string;
    }[] = [];

    for (const doc of accessLinksSnap.docs) {
      const data = doc.data();

      if (data.claimedByUid) continue;

      // SECURITY.P0.11: condominioId é derivado do path real do documento
      // (condominios/{id}/accessLinks/{linkId}), não do campo armazenado, para
      // garantir que o tenant reflita a localização real do doc — e para que
      // claim-link (que agora exige condominioId no body) receba um valor
      // confiável. Não remover: ver src/lib/onboarding/__tests__/f62-claim-link-lookup.test.ts.
      const condominioId = doc.ref.parent.parent?.id || String(data.condominioId || "");

      links.push({
        linkId: doc.id,
        condominioId,
        condominioNome: String(data.condominioNome || ""),
        blocoNome: String(data.blocoNome || ""),
        unidadeNumero: String(data.unidadeNumero || ""),
        tipoVinculo: String(data.tipoVinculo || "PROPRIETARIO"),
      });
    }

    console.log("[onboarding/eligible-links]", JSON.stringify(sanitizeOnboardingLog({
      operation: "SELF_ONBOARDING_SEARCH",
      uid: ctx.uid,
      matches: links.length,
    })));

    return NextResponse.json({ ok: true, links });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[onboarding/eligible-links] Erro:", err?.message);
    return jsonError("Erro inesperado", 500);
  }
}
