/**
 * F.2.5 — CREATE ACCESS LINK (admin server-side)
 *
 * POST /api/onboarding/create-access-link
 *
 * Cria um documento accessLink para permitir que um morador
 * vincule sua conta Firebase posteriormente via self-onboarding.
 *
 * Requer membership ATIVO com role autorizada no condomínio.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { normEmail, sanitizeOnboardingLog } from "@/lib/onboarding/service";
import { normUnidade, normBloco } from "@/lib/normalization/location";

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

    const condominioId = String(body.condominioId || "").trim();
    const personIdProvided = String(body.personId || "").trim();
    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim();
    const emailNorm = normEmail(email);
    const blocoId = String(body.blocoId || "").trim();
    const unitDocId = String(body.unitDocId || "").trim();
    const roleAcesso = String(body.roleAcesso || "MORADOR").toUpperCase();
    const tipoVinculo = String(body.tipoVinculo || "PROPRIETARIO").toUpperCase();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!nome && !personIdProvided) return jsonError("nome ou personId é obrigatório.", 400);
    if (!email) return jsonError("email é obrigatório.", 400);
    if (!blocoId) return jsonError("blocoId é obrigatório.", 400);
    if (!unitDocId) return jsonError("unitDocId é obrigatório.", 400);

    if (roleAcesso !== "MORADOR") {
      return jsonError("Self-onboarding disponível apenas para MORADOR. Use o fluxo de convite para outros papéis.", 400);
    }

    const VALID_TIPOS = ["PROPRIETARIO", "INQUILINO", "MORADOR_PERMANENTE", "DEPENDENTE"];
    if (!VALID_TIPOS.includes(tipoVinculo)) {
      return jsonError(`tipoVinculo inválido. Válidos: ${VALID_TIPOS.join(", ")}`, 400);
    }

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
        return jsonError("Seu perfil não tem permissão para criar vínculos de acesso.", 403);
      }
    }

    // Auto-create or resolve Pessoa
    let personId = personIdProvided;
    let personNome = nome;

    if (personId) {
      const personRef = db
        .collection("condominios")
        .doc(condominioId)
        .collection("pessoas")
        .doc(personId);
      const personSnap = await personRef.get();
      if (!personSnap.exists) {
        return jsonError("Pessoa não encontrada neste condomínio.", 404);
      }
      const personData = personSnap.data() || {};
      const personStatus = String(personData.status || "").toUpperCase();
      if (personStatus !== "ATIVO") {
        return jsonError("Pessoa não está ATIVA.", 400);
      }
      personNome = String(personData.nome || nome);
    } else {
      // Create Pessoa automatically
      const existingPessoasByEmail = await db
        .collection("condominios")
        .doc(condominioId)
        .collection("pessoas")
        .where("emailNorm", "==", emailNorm)
        .where("status", "==", "ATIVO")
        .limit(1)
        .get();

      if (!existingPessoasByEmail.empty) {
        personId = existingPessoasByEmail.docs[0].id;
        personNome = String(existingPessoasByEmail.docs[0].data().nome || nome);
      } else {
        const newPersonRef = db
          .collection("condominios")
          .doc(condominioId)
          .collection("pessoas")
          .doc();
        personId = newPersonRef.id;

        await newPersonRef.set({
          condominioId,
          nome,
          email,
          emailNorm,
          status: "ATIVO",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          metadata: { origem: "SELF_ONBOARDING" },
        });
      }
    }

    const blocoRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("blocos")
      .doc(blocoId);
    const blocoSnap = await blocoRef.get();
    if (!blocoSnap.exists) {
      return jsonError("Bloco não pertence a este condomínio.", 400);
    }
    const blocoData = blocoSnap.data() || {};

    const unidadeRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("blocos")
      .doc(blocoId)
      .collection("unidades")
      .doc(unitDocId);
    const unidadeSnap = await unidadeRef.get();
    if (!unidadeSnap.exists) {
      return jsonError("Unidade não encontrada no bloco informado.", 400);
    }
    const unidadeData = unidadeSnap.data() || {};

    const unidadeNumero = String(unidadeData.numero || "");
    const unidadeIdNormVal = normUnidade(unidadeNumero);
    const blocoNome = String(blocoData.nome || "");
    const blocoIdNormVal = normBloco(blocoNome);

    const condominioDoc = await db.collection("condominios").doc(condominioId).get();
    const condominioNome = condominioDoc.exists
      ? String(condominioDoc.data()?.nome || condominioId)
      : condominioId;

    const existingSnap = await db
      .collection("condominios")
      .doc(condominioId)
      .collection("accessLinks")
      .where("personId", "==", personId)
      .where("unitDocId", "==", unitDocId)
      .where("accessStatus", "==", "PENDENTE_VINCULO")
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      return NextResponse.json({
        ok: true,
        linkId: existing.id,
        alreadyExists: true,
        status: existing.data().accessStatus,
        personId,
      });
    }

    const linkRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("accessLinks")
      .doc();

    const linkData = {
      condominioId,
      personId,
      email,
      emailNorm,
      blocoId,
      unitDocId,
      unidadeId: unidadeNumero,
      unidadeIdNorm: unidadeIdNormVal,
      blocoIdNorm: blocoIdNormVal,
      roleAcesso: "MORADOR" as const,
      tipoVinculo,
      accessStatus: "PENDENTE_VINCULO" as const,
      condominioNome,
      blocoNome,
      unidadeNumero,
      claimedByUid: null,
      claimedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await linkRef.set(linkData);

    console.log("[onboarding/create-access-link]", JSON.stringify(sanitizeOnboardingLog({
      operation: "ACCESS_LINK_CREATED",
      condominioId,
      linkId: linkRef.id,
      actorUid: requesterUid,
    })));

    return NextResponse.json({
      ok: true,
      linkId: linkRef.id,
      personId,
      condominioId,
      unidadeNumero,
      blocoNome,
      condominioNome,
      accessStatus: "PENDENTE_VINCULO",
    });
  } catch (err: any) {
    console.error("[onboarding/create-access-link] Erro:", err?.message);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
