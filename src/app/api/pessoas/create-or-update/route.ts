/**
 * F.2.6 — UNIFIED ADMIN PERSON CREATION
 *
 * POST /api/pessoas/create-or-update
 *
 * Operação server-side coordenada que:
 * 1. Cria/atualiza Pessoa
 * 2. Se permitirAcessoApp + modo=SELF_ONBOARDING → cria AccessLink
 * 3. Se permitirAcessoApp + modo=CONVITE_CODIGO → cria convite (delega)
 *
 * Nunca confia em payload do client. Tudo é validado server-side.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkAdminAuth } from "@/lib/pessoas/authorization";
import { buildPessoaDoc, validatePersonPayload, maskPersonId, sanitizeLogData } from "@/lib/pessoas/service";
import { normEmail, sanitizeOnboardingLog } from "@/lib/onboarding/service";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import type { AdminPersonPayload, AdminPersonResult } from "@/lib/pessoas/types";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const ADMIN_ROLES = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"] as const;

export async function POST(req: Request) {
  const db = adminDb();

  try {
    const body = (await req.json().catch(() => ({}))) as AdminPersonPayload;

    const condominioId = String(body.condominioId || "").trim();
    const nome = String(body.nome || "").trim();
    const email = body.email ? String(body.email).trim() : null;
    const emailNorm = email ? normEmail(email) : null;
    const telefone = body.telefone ? String(body.telefone).trim() : null;
    const blocoId = body.blocoId ? String(body.blocoId).trim() : null;
    const unitDocId = body.unitDocId ? String(body.unitDocId).trim() : null;
    const tipoVinculo = body.tipoVinculo || null;
    const permitirAcessoApp = body.permitirAcessoApp === true;
    const modoAcesso = body.modoAcesso || (permitirAcessoApp ? "SELF_ONBOARDING" : null);

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!nome) return jsonError("nome é obrigatório.", 400);

    if (permitirAcessoApp && !email) {
      return jsonError("E-mail é obrigatório para permitir acesso ao aplicativo.", 400);
    }

    if (permitirAcessoApp && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError("Formato de e-mail inválido.", 400);
    }

    const auth = await checkAdminAuth({
      request: req,
      condominioId,
      allowedRoles: [...ADMIN_ROLES],
    });

    if (!auth.ok) return jsonError(auth.error || "Acesso negado.", auth.status || 403);

    const condoRef = db.collection("condominios").doc(condominioId);
    const condoSnap = await condoRef.get();
    if (!condoSnap.exists) {
      return jsonError("Condomínio não encontrado.", 404);
    }

    // Validate bloco × unidade if both provided
    if (blocoId && unitDocId) {
      const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId);
      const blocoSnap = await blocoRef.get();
      if (!blocoSnap.exists) {
        return jsonError("Bloco não pertence a este condomínio.", 400);
      }

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
    }

    // Create or resolve Pessoa
    let personId: string;

    if (emailNorm) {
      const existingByEmail = await db
        .collection("condominios")
        .doc(condominioId)
        .collection("pessoas")
        .where("emailNorm", "==", emailNorm)
        .where("status", "==", "ATIVO")
        .limit(1)
        .get();

      if (!existingByEmail.empty) {
        personId = existingByEmail.docs[0].id;
      } else {
        const newRef = db.collection("condominios").doc(condominioId).collection("pessoas").doc();
        await newRef.set(buildPessoaDoc({ condominioId, nome, email, telefone, metadata: { origem: "CADASTRO_MANUAL" } }));
        personId = newRef.id;
      }
    } else {
      const newRef = db.collection("condominios").doc(condominioId).collection("pessoas").doc();
      await newRef.set(buildPessoaDoc({ condominioId, nome, email, telefone, metadata: { origem: "CADASTRO_MANUAL" } }));
      personId = newRef.id;
    }

    const result: AdminPersonResult = {
      ok: true,
      personId,
    };

    // Create accessLink if self-onboarding
    if (permitirAcessoApp && modoAcesso === "SELF_ONBOARDING" && email && emailNorm && blocoId && unitDocId && tipoVinculo) {
      const condominioDoc = await db.collection("condominios").doc(condominioId).get();
      const condominioNome = condominioDoc.exists ? String(condominioDoc.data()?.nome || condominioId) : condominioId;

      const blocoDoc = await db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId).get();
      const blocoNome = blocoDoc.exists ? String(blocoDoc.data()?.nome || blocoId) : blocoId;

      const unidadeDoc = await db
        .collection("condominios")
        .doc(condominioId)
        .collection("blocos")
        .doc(blocoId)
        .collection("unidades")
        .doc(unitDocId)
        .get();
      const unidadeData = unidadeDoc.data() || {};
      const unidadeNumero = String(unidadeData.numero || "");
      const unidadeIdNormVal = normUnidade(unidadeNumero);
      const blocoIdNormVal = normBloco(blocoNome);

      const existingLink = await db
        .collection("condominios")
        .doc(condominioId)
        .collection("accessLinks")
        .where("personId", "==", personId)
        .where("unitDocId", "==", unitDocId)
        .where("accessStatus", "==", "PENDENTE_VINCULO")
        .limit(1)
        .get();

      if (!existingLink.empty) {
        result.linkId = existingLink.docs[0].id;
        result.accessStatus = "PENDENTE_VINCULO";
      } else {
        const linkRef = db
          .collection("condominios")
          .doc(condominioId)
          .collection("accessLinks")
          .doc();

        await linkRef.set({
          condominioId,
          personId,
          email,
          emailNorm,
          blocoId,
          unitDocId,
          unidadeId: unidadeNumero,
          unidadeIdNorm: unidadeIdNormVal,
          blocoIdNorm: blocoIdNormVal,
          roleAcesso: "MORADOR",
          tipoVinculo,
          accessStatus: "PENDENTE_VINCULO",
          condominioNome,
          blocoNome,
          unidadeNumero,
          claimedByUid: null,
          claimedAt: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        result.linkId = linkRef.id;
        result.accessStatus = "PENDENTE_VINCULO";
      }

      result.mode = "SELF_ONBOARDING";

      console.log("[pessoas/create-or-update]", JSON.stringify(sanitizeOnboardingLog({
        operation: "ADMIN_PERSON_WITH_ACCESS",
        condominioId,
        personId: maskPersonId(personId),
        mode: "SELF_ONBOARDING",
      })));
    } else if (permitirAcessoApp && modoAcesso === "CONVITE_CODIGO") {
      result.mode = "CONVITE_CODIGO";
      result.error = "Convite via código deve ser criado separadamente via POST /api/convites/create.";
    } else {
      result.mode = "PERSON_ONLY";

      console.log("[pessoas/create-or-update]", JSON.stringify(sanitizeLogData({
        operation: "ADMIN_PERSON_CREATED",
        condominioId,
        personId: maskPersonId(personId),
      })));
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[pessoas/create-or-update] Erro:", err?.message);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
