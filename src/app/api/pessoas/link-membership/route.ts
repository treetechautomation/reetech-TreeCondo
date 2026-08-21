/**
 * F.2.1 — LINK PESSOA ↔ MEMBERSHIP (server-side)
 *
 * POST /api/pessoas/link-membership
 *
 * Associa uma Pessoa (pessoas/{personId}) a um membro (membros/{uid}).
 * Idempotente. Valida tenant isolation e cardinalidade.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { validateLinkMembershipPayload, buildLinkResult, maskPersonId } from "@/lib/pessoas/service";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ALLOWED_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const validationError = validateLinkMembershipPayload(body);
    if (validationError) return jsonError(validationError, 400);

    const condominioId = String(body.condominioId || "").trim();
    const personId = String(body.personId || "").trim();
    const uid = String(body.uid || "").trim();

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ALLOWED_ROLES,
    });

    const db = adminDb();
    const personRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("pessoas")
      .doc(personId);
    const personSnap = await personRef.get();

    if (!personSnap.exists) {
      return jsonError("Pessoa não encontrada neste condomínio.", 404);
    }

    const membroRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("membros")
      .doc(uid);
    const membroSnap = await membroRef.get();

    if (!membroSnap.exists) {
      return jsonError("Membro não encontrado neste condomínio.", 404);
    }

    const membroData = membroSnap.data() || {};
    const existingPersonId = membroData.personId || null;

    if (existingPersonId === personId) {
      return NextResponse.json(buildLinkResult(personId, uid, condominioId, true));
    }

    if (existingPersonId && existingPersonId !== personId) {
      return jsonError(
        `Este membro já está vinculado a outra pessoa (personId: ${maskPersonId(existingPersonId)}).`,
        409
      );
    }

    const allMembrosRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("membros");
    const dupSnap = await allMembrosRef.where("personId", "==", personId).limit(1).get();

    if (!dupSnap.empty) {
      const dupUid = dupSnap.docs[0].id;
      return jsonError(
        `Esta pessoa já está vinculada a outro membro (uid: ${maskPersonId(dupUid)}) neste condomínio.`,
        409
      );
    }

    await membroRef.set(
      {
        personId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log("[pessoas/link-membership]", JSON.stringify({
      operation: "PERSON_LINKED_TO_MEMBERSHIP",
      condominioId,
      personId: maskPersonId(personId),
      uid: maskPersonId(uid),
      actorUid: maskPersonId(ctx.uid),
    }));

    return NextResponse.json(buildLinkResult(personId, uid, condominioId, false));
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("[pessoas/link-membership] Erro:", maskPersonId(e?.message || ""));
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
