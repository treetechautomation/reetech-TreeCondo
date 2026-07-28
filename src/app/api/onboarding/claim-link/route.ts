/**
 * F.2.5 — CLAIM LINK (server-side)
 *
 * POST /api/onboarding/claim-link
 *
 * Transação atômica: vincula Auth user a Pessoa e cria Membership.
 * Idempotente. Valida server-side: email verificado, emailNorm, accessStatus.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rateLimiter";
import { normEmail, sanitizeOnboardingLog } from "@/lib/onboarding/service";
import { buildMenuPermissions } from "@/lib/pessoas/menuPermissions";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
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

    const rate = checkRateLimit({ key: rateLimitKey(uid, null, "claim-link"), limit: 5, windowSec: 60 });
    if (!rate.allowed) return rateLimitResponse(rate);

    const authUser = await aauth.getUser(uid);
    if (!authUser.emailVerified) {
      return jsonError("EMAIL_NOT_VERIFIED. Verifique seu e-mail antes de vincular.", 403);
    }

    const authEmail = normEmail(authUser.email);
    if (!authEmail) {
      return jsonError("Conta sem e-mail associado.", 400);
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const linkId = String(body.linkId || "").trim();
    if (!linkId) return jsonError("linkId é obrigatório.", 400);

    const accessLinksSnap = await db
      .collectionGroup("accessLinks")
      .where("__name__", "==", linkId)
      .limit(1)
      .get();

    if (accessLinksSnap.empty) {
      console.log("[onboarding/claim-link]", JSON.stringify(sanitizeOnboardingLog({
        operation: "SELF_ONBOARDING_CLAIM_FAILED",
        reason: "LINK_NOT_FOUND",
        uid,
      })));
      return jsonError("Vínculo não encontrado. Solicite à administração.", 404);
    }

    const linkDoc = accessLinksSnap.docs[0];
    const linkData = linkDoc.data();

    if (normEmail(linkData.email) !== authEmail) {
      console.log("[onboarding/claim-link]", JSON.stringify(sanitizeOnboardingLog({
        operation: "SELF_ONBOARDING_CLAIM_FAILED",
        reason: "EMAIL_MISMATCH",
        uid,
      })));
      return jsonError("E-mail não corresponde ao cadastro.", 403);
    }

    if (linkData.accessStatus === "VINCULADO") {
      return NextResponse.json({
        ok: true,
        alreadyLinked: true,
        condominioId: linkData.condominioId,
        personId: linkData.personId,
        uid,
        role: linkData.roleAcesso,
      });
    }

    if (linkData.accessStatus !== "PENDENTE_VINCULO") {
      return jsonError("Este vínculo não está disponível para ativação.", 403);
    }

    if (linkData.claimedByUid) {
      return jsonError("LINK_ALREADY_CLAIMED", 409);
    }

    const condominioId = linkData.condominioId;
    const blocoId = linkData.blocoId;
    const unitDocId = linkData.unitDocId;
    const unidadeId = linkData.unidadeId;
    const unidadeIdNorm = linkData.unidadeIdNorm;
    const blocoIdNorm = linkData.blocoIdNorm;
    const personId = linkData.personId;
    const roleAcesso = linkData.roleAcesso || "MORADOR";

    if (roleAcesso !== "MORADOR") {
      return jsonError("Self-onboarding disponível apenas para MORADOR. Roles administrativas requerem convite.", 403);
    }

    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const vinculoRef = db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId);
    const userRootRef = db.collection("userCondominios").doc(uid);

    const membroSnap = await membroRef.get();
    if (membroSnap.exists) {
      const membroData = membroSnap.data() || {};
      const membroStatus = String(membroData.status || "").toUpperCase();
      if (membroStatus === "ATIVO") {
        return NextResponse.json({
          ok: true,
          alreadyLinked: true,
          condominioId,
          personId,
          uid,
          role: roleAcesso,
        });
      }
    }

    await db.runTransaction(async (tx) => {
      const rootSnap = await tx.get(userRootRef);
      if (!rootSnap.exists) {
        tx.set(userRootRef, {
          email: authEmail,
          nome: String(linkData.nome || ""),
          createdAt: FieldValue.serverTimestamp(),
          source: "self-onboarding-claim",
        }, { merge: true });
      }

      tx.set(membroRef, {
        nome: String(linkData.nome || authUser.displayName || ""),
        email: authEmail,
        role: roleAcesso,
        blocoId,
        unitDocId,
        unidadeId,
        blocoIdNorm,
        unidadeIdNorm,
        personId,
        status: "ATIVO",
        menuPermissions: buildMenuPermissions("MORADOR"),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.set(vinculoRef, {
        condominioId,
        condominioNome: String(linkData.condominioNome || ""),
        role: roleAcesso,
        blocoId,
        unitDocId,
        unidadeId,
        blocoIdNorm,
        unidadeIdNorm,
        status: "ATIVO",
        source: "self-onboarding-claim",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.update(linkDoc.ref, {
        accessStatus: "VINCULADO",
        claimedByUid: uid,
        claimedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log("[onboarding/claim-link]", JSON.stringify(sanitizeOnboardingLog({
      operation: "SELF_ONBOARDING_CLAIM_SUCCESS",
      uid,
      condominioId,
    })));

    return NextResponse.json({
      ok: true,
      condominioId,
      personId,
      uid,
      role: roleAcesso,
    });
  } catch (err: any) {
    console.error("[onboarding/claim-link] Erro:", err?.message);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
