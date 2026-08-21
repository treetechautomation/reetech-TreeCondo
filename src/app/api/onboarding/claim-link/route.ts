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

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { normEmail, sanitizeOnboardingLog } from "@/lib/onboarding/service";
import { buildMenuPermissions } from "@/lib/pessoas/menuPermissions";

function isValidFirestoreDocId(v: string): boolean {
  return v.length > 0 && v.length <= 1500 && !v.includes("/") && v !== "." && v !== "..";
}

export async function POST(req: Request) {
  const db = adminDb();

  try {
    // UNIT A reconciliation — auth/email-verification/rate-limit consolidated
    // via apiGuard (no condominioId here: tenant is determined below from the
    // caller-supplied, validated linkId + condominioId pair, not from apiGuard).
    const ctx = await apiGuard({
      request: req,
      requireAuth: true,
      requireEmailVerified: true,
      rateLimit: { limit: 5, windowSec: 60 },
    });

    const uid = ctx.uid;
    const authEmail = normEmail(ctx.email);
    if (!authEmail) {
      return jsonError("Conta sem e-mail associado.", 400);
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const linkId = String(body.linkId || "").trim();
    const condominioId = String(body.condominioId || "").trim();
    if (!linkId) return jsonError("linkId é obrigatório.", 400);
    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!isValidFirestoreDocId(linkId) || !isValidFirestoreDocId(condominioId)) {
      return jsonError("Vínculo não encontrado. Solicite à administração.", 404);
    }

    // Lookup tenant-scoped direto: condominios/{condominioId}/accessLinks/{linkId}.
    // Evita FieldPath.documentId() em collectionGroup, que exige path completo e
    // rejeita o ID simples devolvido por eligible-links (F.6.1 root cause).
    //
    // SECURITY.P0.11 note: do not replace this with a collectionGroup("accessLinks")
    // lookup by document ID alone — that pattern cannot verify the link actually
    // belongs to the condominioId the caller supplied, and was the exact bug this
    // tenant-scoped form (2ba36de6) was written to fix. See
    // src/lib/onboarding/__tests__/f62-claim-link-lookup.test.ts.
    const linkRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("accessLinks")
      .doc(linkId);
    const linkSnap = await linkRef.get();

    if (!linkSnap.exists) {
      console.log("[onboarding/claim-link]", JSON.stringify(sanitizeOnboardingLog({
        operation: "SELF_ONBOARDING_CLAIM_FAILED",
        reason: "LINK_NOT_FOUND",
        uid,
      })));
      return jsonError("Vínculo não encontrado. Solicite à administração.", 404);
    }

    const linkDoc = linkSnap;
    const linkData = linkDoc.data()!;

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
        condominioId,
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
        nome: String(linkData.nome || ctx.decodedToken?.name || ""),
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
    if (err instanceof Response) return err;
    console.error("[onboarding/claim-link] Erro:", err?.message);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
