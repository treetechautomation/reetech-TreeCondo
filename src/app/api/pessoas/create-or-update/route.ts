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
import {
  buildPessoaDoc,
  validatePersonPayload,
  validateCategoriaPessoa,
  validateMoraNoCondominio,
  validateBlocoAtuacaoId,
  maskPersonId,
  sanitizeLogData,
} from "@/lib/pessoas/service";
import { normEmail, sanitizeOnboardingLog } from "@/lib/onboarding/service";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import type { AdminPersonPayload, AdminPersonResult } from "@/lib/pessoas/types";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ALLOWED_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function POST(req: Request) {
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

    const categoriaPessoaError = validateCategoriaPessoa(body.categoriaPessoa);
    if (categoriaPessoaError) return jsonError(categoriaPessoaError, 400);

    const moraNoCondominioError = validateMoraNoCondominio(body.moraNoCondominio);
    if (moraNoCondominioError) return jsonError(moraNoCondominioError, 400);

    const blocoAtuacaoIdError = validateBlocoAtuacaoId(body.blocoAtuacaoId);
    if (blocoAtuacaoIdError) return jsonError(blocoAtuacaoIdError, 400);

    const categoriaPessoa = body.categoriaPessoa ?? null;
    const moraNoCondominio = body.moraNoCondominio ?? null;
    const blocoAtuacaoId = body.blocoAtuacaoId ? String(body.blocoAtuacaoId).trim() : null;

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ALLOWED_ROLES,
    });

    const db = adminDb();
    const condoRef = db.collection("condominios").doc(condominioId);
    const condoSnap = await condoRef.get();
    if (!condoSnap.exists) {
      return jsonError("Condomínio não encontrado.", 404);
    }

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

    if (blocoAtuacaoId) {
      const blocoAtuacaoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoAtuacaoId);
      const blocoAtuacaoSnap = await blocoAtuacaoRef.get();
      if (!blocoAtuacaoSnap.exists) {
        return jsonError("Bloco de atuação não pertence a este condomínio.", 400);
      }
    }

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
        await newRef.set(
          buildPessoaDoc({ condominioId, nome, email, telefone, categoriaPessoa, moraNoCondominio, blocoAtuacaoId, metadata: { origem: "CADASTRO_MANUAL" } }),
        );
        personId = newRef.id;
      }
    } else {
      const newRef = db.collection("condominios").doc(condominioId).collection("pessoas").doc();
      await newRef.set(
        buildPessoaDoc({ condominioId, nome, email, telefone, categoriaPessoa, moraNoCondominio, blocoAtuacaoId, metadata: { origem: "CADASTRO_MANUAL" } }),
      );
      personId = newRef.id;
    }

    const result: AdminPersonResult = {
      ok: true,
      personId,
    };

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
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("[pessoas/create-or-update] Erro:", e?.message);
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
