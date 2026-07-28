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

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { validateLinkMembershipPayload, buildLinkResult, maskPersonId } from "@/lib/pessoas/service";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const ROLES_AUTORIZADAS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

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

    const requesterUid = decoded.uid as string;
    const isSuper =
      decoded.super_admin === true ||
      (decoded as any).superAdmin === true ||
      String((decoded as any).role || "").toUpperCase() === "SUPER_ADMIN";

    const body = (await req.json().catch(() => ({}))) as any;
    const validationError = validateLinkMembershipPayload(body);
    if (validationError) return jsonError(validationError, 400);

    const condominioId = String(body.condominioId || "").trim();
    const personId = String(body.personId || "").trim();
    const uid = String(body.uid || "").trim();

    if (!isSuper) {
      const vincRef = db
        .collection("userCondominios")
        .doc(requesterUid)
        .collection("vinculos")
        .doc(condominioId);
      const vincSnap = await vincRef.get();

      if (!vincSnap.exists) {
        return jsonError("Você não possui vínculo com este condomínio.", 403);
      }

      const vincData = vincSnap.data() || {};
      const role = String(vincData.role || "").toUpperCase();
      const status = String(vincData.status || "").toUpperCase();

      if (status !== "ATIVO") {
        return jsonError("Seu vínculo neste condomínio não está ativo.", 403);
      }

      if (!ROLES_AUTORIZADAS.includes(role)) {
        return jsonError("Seu perfil não tem permissão para vincular pessoa a membro.", 403);
      }
    }

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
      actorUid: maskPersonId(requesterUid),
    }));

    return NextResponse.json(buildLinkResult(personId, uid, condominioId, false));
  } catch (err: any) {
    console.error("[pessoas/link-membership] Erro:", maskPersonId(err?.message || ""));
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
