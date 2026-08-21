/**
 * ADMIN_CONDOMINIO.1C — CANONICAL IDENTITY RESOLVER
 *
 * GET /api/auth/resolve-identity
 *
 * Resolve o estado de onboarding do usuário autenticado, para uso
 * centralizado por LoginClient.tsx e AppLayout.tsx (evita duplicar a
 * lógica de decisão em dois componentes — ver ADMIN_CONDOMINIO.1B seção 7).
 *
 * Identidade vem exclusivamente do ID token verificado (uid). Nenhum
 * condominioId ou email fornecido pelo client é aceito como prova de
 * pertencimento — ver ADMIN_CONDOMINIO.1B seção 9 (segurança multi-tenant).
 *
 * Estados retornados:
 *  - SUPER_ADMIN            : possui claim de super admin.
 *  - ACTIVE_LINKED_USER     : possui ao menos um vínculo ATIVO.
 *  - PENDING_INVITED_USER   : possui convite PENDENTE/PROCESSADO gerado
 *                              para este uid (qualquer role convidável),
 *                              mas ainda não concluiu o primeiro acesso.
 *  - NO_PENDING_INVITE      : nenhum dos casos acima. O chamador deve
 *                              preservar o comportamento atual (fluxo de
 *                              self-onboarding MORADOR via
 *                              /onboarding/vincular-condominio,
 *                              inalterado por este gate).
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { resolveIdentityState } from "@/lib/onboarding/identityResolver";

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

    const isSuper =
      decoded.super_admin === true ||
      (decoded as any).superAdmin === true ||
      String((decoded as any).role || "").toUpperCase() === "SUPER_ADMIN" ||
      (Array.isArray((decoded as any).roles) &&
        (decoded as any).roles.includes("SUPER_ADMIN"));

    if (isSuper) {
      return NextResponse.json({ ok: true, state: "SUPER_ADMIN" });
    }

    const vinculosSnap = await db
      .collection("userCondominios")
      .doc(uid)
      .collection("vinculos")
      .get();
    const vinculos = vinculosSnap.docs.map((d) => ({ status: d.data()?.status }));

    // Convite pendente gerado para ESTE uid (nunca por email fornecido pelo
    // client) — cobre ADMIN_CONDOMINIO, SINDICO, ADMIN, PORTEIRO, ZELADOR,
    // FUNCIONARIO e MORADOR convidado (não o self-onboarding via accessLinks,
    // que não passa por `convites`).
    const convitesSnap = await db
      .collection("convites")
      .where("uidGerado", "==", uid)
      .get();
    const convites = convitesSnap.docs.map((d) => ({ id: d.id, status: d.data()?.status }));

    const resolution = resolveIdentityState({ isSuper, vinculos, convites });

    return NextResponse.json({ ok: true, ...resolution });
  } catch (err: any) {
    console.error("[auth/resolve-identity] Erro:", err?.message);
    return jsonError("Erro inesperado", 500);
  }
}
