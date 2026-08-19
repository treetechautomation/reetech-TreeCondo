/**
 * REV.1 — REVOKE MEMBER ACCESS (admin, tenant-scoped, server-side)
 *
 * POST /api/admin/membros/revoke
 *
 * Desvincula o acesso de um residente/membro a UM condomínio específico,
 * sem tocar em: Firebase Auth (conta global), documento Pessoa, ou
 * histórico de negócio (reservas, encomendas, incidentes, etc.).
 *
 * Soft-delete apenas — nada é apagado. Idempotente: uma segunda chamada
 * não realiza escritas adicionais e não sobrescreve o registro da primeira
 * revogação (revokedAt/revokedByUid/revocationReason).
 *
 * Payload: { condominioId, targetUid, reason }
 * actorUid vem SEMPRE do token verificado — nunca do corpo da requisição.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkAdminAuth } from "@/lib/pessoas/authorization";
import type { VinculoRole } from "@/lib/pessoas/types";
import { writeAdminAuditLog } from "@/lib/pessoas/adminAuditLog";
import {
  validateRevokePayload,
  normalizeRevokePayload,
  checkRevokeGuardrails,
  isAlreadyRevoked,
  resolveUniqueAccessLink,
  buildMembroRevocationPatch,
  buildVinculoRevocationPatch,
  buildAccessLinkRevocationPatch,
} from "@/lib/pessoas/revokeAccessService";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// Roles autorizadas a gerenciar o condomínio (mesmo conjunto usado em
// create-access-link e promote-sindico), fora do bypass de SUPER_ADMIN
// já tratado por checkAdminAuth.
const ALLOWED_ROLES: VinculoRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

function decodedIsSuperAdmin(decoded: any): boolean {
  return (
    decoded?.super_admin === true ||
    decoded?.superAdmin === true ||
    String(decoded?.role || "").toUpperCase() === "SUPER_ADMIN"
  );
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    // --- 1. Autenticação: actorUid vem do token, nunca do body ---
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente.", 401);

    let decoded: any;
    try {
      decoded = await aauth.verifyIdToken(token);
    } catch {
      return jsonError("Token inválido ou expirado.", 401);
    }

    const actorUid = decoded.uid as string;
    const actorEmail = (decoded.email as string | undefined) ?? null;

    // --- 2. Payload ---
    const rawBody = (await req.json().catch(() => ({}))) as any;
    const validationError = validateRevokePayload(rawBody);
    if (validationError) return jsonError(validationError, 400);

    const { condominioId, targetUid, reason } = normalizeRevokePayload(rawBody);

    // --- 3. Self-revogação bloqueada (checagem barata, antes de qualquer I/O) ---
    if (targetUid === actorUid) {
      return jsonError("Auto-revogação não é permitida via este endpoint.", 400);
    }

    // --- 4. Autorização: ator precisa gerenciar este condomínio ---
    const authz = await checkAdminAuth({
      request: req,
      condominioId,
      allowedRoles: ALLOWED_ROLES,
    });
    if (!authz.ok || !authz.context) {
      return jsonError(authz.error || "Acesso negado.", authz.status || 403);
    }
    const actorIsSuperAdmin = authz.context.isSuperAdmin || decodedIsSuperAdmin(decoded);

    // --- 5. Alvo é SUPER_ADMIN? Só outro SUPER_ADMIN pode revogar ---
    let targetIsSuperAdmin = false;
    try {
      const targetUserRecord = await aauth.getUser(targetUid);
      const claims = targetUserRecord.customClaims || {};
      targetIsSuperAdmin =
        claims.super_admin === true ||
        claims.superAdmin === true ||
        String((claims as any).role || "").toUpperCase() === "SUPER_ADMIN";
    } catch {
      // Usuário Auth pode não existir mais — não é fatal aqui, a validação
      // do membro no Firestore abaixo é quem decide se a operação prossegue.
      targetIsSuperAdmin = false;
    }

    const guard = checkRevokeGuardrails({
      actorUid,
      targetUid,
      actorIsSuperAdmin,
      targetIsSuperAdmin,
    });
    if (!guard.ok) {
      return jsonError(guard.error, guard.status);
    }

    // --- 6. Validação do alvo (read-only, antes da transação) ---
    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(targetUid);
    const vinculoRef = db.collection("userCondominios").doc(targetUid).collection("vinculos").doc(condominioId);

    const [membroSnap, vinculoSnap] = await Promise.all([membroRef.get(), vinculoRef.get()]);

    if (!membroSnap.exists) {
      return jsonError("Membro não encontrado neste condomínio.", 404);
    }
    if (!vinculoSnap.exists) {
      return jsonError("Vínculo não encontrado para este membro neste condomínio.", 404);
    }

    const accessLinksSnap = await db
      .collection("condominios")
      .doc(condominioId)
      .collection("accessLinks")
      .where("claimedByUid", "==", targetUid)
      .where("accessStatus", "==", "VINCULADO")
      .get();
    // Nota: condominioId não precisa ser filtrado explicitamente — o
    // escopo do tenant já é garantido pelo caminho da subcoleção
    // condominios/{condominioId}/accessLinks (nunca uma collectionGroup).

    const linkResolution = resolveUniqueAccessLink({ matches: accessLinksSnap.docs });
    if (!linkResolution.ok) {
      return jsonError(linkResolution.error, linkResolution.status);
    }
    const accessLinkDoc = linkResolution.link;
    const accessLinkRef = accessLinkDoc.ref;

    const membroBefore = membroSnap.data() || {};
    const vinculoBefore = vinculoSnap.data() || {};

    // --- 7. Idempotência real: se já revogado, nenhuma escrita ---
    if (isAlreadyRevoked(membroBefore, vinculoBefore)) {
      return NextResponse.json({ ok: true, alreadyRevoked: true, condominioId, targetUid });
    }

    // --- 8. Transação atômica ---
    let didWrite = false;
    await db.runTransaction(async (tx) => {
      const [membroTxSnap, vinculoTxSnap, accessLinkTxSnap] = await Promise.all([
        tx.get(membroRef),
        tx.get(vinculoRef),
        tx.get(accessLinkRef),
      ]);

      if (!membroTxSnap.exists) throw new Error("Membro não encontrado neste condomínio.");
      if (!vinculoTxSnap.exists) throw new Error("Vínculo não encontrado para este membro neste condomínio.");

      const membroData = membroTxSnap.data() || {};
      const vinculoData = vinculoTxSnap.data() || {};

      if (isAlreadyRevoked(membroData, vinculoData)) {
        // Corrida com outra revogação concorrente: no-op idempotente.
        return;
      }

      const now = FieldValue.serverTimestamp();

      tx.update(membroRef, buildMembroRevocationPatch(now));
      tx.update(vinculoRef, buildVinculoRevocationPatch(now));

      const accessLinkData = (accessLinkTxSnap.data() || {}) as { revokedAt?: unknown };
      const accessLinkPatch = buildAccessLinkRevocationPatch(accessLinkData, actorUid, reason, now);
      if (accessLinkPatch) {
        tx.update(accessLinkRef, accessLinkPatch);
      }

      didWrite = true;
    });

    if (!didWrite) {
      return NextResponse.json({ ok: true, alreadyRevoked: true, condominioId, targetUid });
    }

    // --- 9. Auditoria (fora da transação; não deve derrubar operação já concluída) ---
    // Tenant-scoped: condominios/{condominioId}/adminAuditLogs/{autoId}.
    await writeAdminAuditLog(condominioId, {
      actorUid,
      actorEmail,
      action: "REVOKE_ACCESS",
      entity: "MEMBRO",
      entityId: targetUid,
      before: {
        membroStatus: membroBefore.status ?? null,
        vinculoStatus: vinculoBefore.status ?? null,
        vinculoAtivo: vinculoBefore.ativo ?? null,
      },
      after: {
        membroStatus: "INATIVO",
        vinculoStatus: "INATIVO",
        vinculoAtivo: false,
        reason,
      },
      source: "API",
    });

    return NextResponse.json({ ok: true, alreadyRevoked: false, condominioId, targetUid });
  } catch (err: any) {
    console.error("[admin/membros/revoke] Erro:", err?.message);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
