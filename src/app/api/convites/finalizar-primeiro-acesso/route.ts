
import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { buildMenuPermissions } from "@/lib/pessoas/menuPermissions";
import { normEmail } from "@/lib/onboarding/service";
import { normalizeInviteCode, isValidInviteCode } from "@/lib/normalization/code";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}



function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      code?: string;
      senha?: string;
    };

    const email = normEmail(body.email);
    const code = normalizeInviteCode(body.code);
    const senha = String(body.senha ?? "");

    if (!email) return jsonError("Email é obrigatório", 400);
    if (!code || !isValidInviteCode(code)) {
      return jsonError("Código inválido. Use o formato: TC-XXXXXXXX", 400);
    }
    if (senha.length < 6) return jsonError("A senha precisa ter pelo menos 6 caracteres.", 400);

    const db = adminDb();
    const auth = adminAuth();

    const codigoHash = sha256Hex(code);

    const q = await db.collection("convites").where("codigoHash", "==", codigoHash).limit(1).get();
    if (q.empty) return jsonError("Código não encontrado ou inválido.", 404);

    const conviteDoc = q.docs[0];
    const convite = conviteDoc.data() as any;

    const conviteEmail = normEmail(convite.email);
    if (conviteEmail !== email) return jsonError("Este código não pertence a este e-mail.", 403);

    const status = String(convite.status || "PENDENTE").toUpperCase();
    if (status === "CONCLUIDO" || status === "ACEITO") {
      // idempotente: se já concluiu, não quebra o usuário novo
      return NextResponse.json({ ok: true, alreadyDone: true });
    }

    const uid = String(convite.uidGerado || "").trim();
    const condominioId = String(convite.condominioId || "").trim();
    const role = String(convite.tipo || convite.role || "").toUpperCase();

    if (!uid) return jsonError("Convite inválido (uid ausente).", 500);
    if (!condominioId) return jsonError("Convite inválido (condominioId ausente).", 500);

    // 1) garante usuário com senha (SEM customToken)
    try {
      await auth.updateUser(uid, {
        email,
        password: senha,
        displayName: String(convite.nome || ""),
      });
    } catch (e: any) {
      // se não existir, cria
      if (String(e?.code || "").includes("auth/user-not-found")) {
        await auth.createUser({
          uid,
          email,
          password: senha,
          displayName: String(convite.nome || ""),
        });
      } else {
        throw e;
      }
    }

    const vinculoRef = db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId);
    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const userCondominioRootRef = db.collection("userCondominios").doc(uid);

    const conviteBlocoId = convite.bloco ?? convite.blocoId ?? null;
    const conviteUnidadeId = convite.apartamento ?? convite.unidadeId ?? null;
    const conviteUnitDocId = convite.unitDocId ?? null;
    const unidadeIdNormVal = convite.unidadeIdNorm || (conviteUnidadeId ? normUnidade(conviteUnidadeId) : null);
    const blocoIdNormVal = convite.blocoIdNorm || (conviteBlocoId ? normBloco(conviteBlocoId) : null);

    const isFuncionario = role === "FUNCIONARIO";
    const membroRole = isFuncionario ? "ZELADOR" : role;
    const membroTipo = isFuncionario ? "FUNCIONARIO" : null;

    console.warn(`[API/finalizar-acesso] Preparando transação para uid: ${uid}, condId: ${condominioId}`);

    // 2) transação: vinculo + membro ativo + convite concluído
    await db.runTransaction(async (tx) => {
      // 2.1 Garante que o documento raiz do usuário exista em userCondominios
      const userRootSnap = await tx.get(userCondominioRootRef);
      if (!userRootSnap.exists) {
        tx.set(userRootSnap.ref, {
          email: email,
          nome: String(convite.nome || ""),
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      
      // 2.2 Cria/atualiza o vínculo do usuário com o condomínio
      const vinculoPayload = {
        condominioId,
        condominioNome: String(convite.condominioNome || ""),
        role: membroRole,
        blocoId: conviteBlocoId,
        unidadeId: conviteUnidadeId,
        unitDocId: conviteUnitDocId,
        blocoIdNorm: blocoIdNormVal,
        unidadeIdNorm: unidadeIdNormVal,
        status: "ATIVO",
        source: "finalizar-primeiro-acesso",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      console.warn(`[API/finalizar-acesso] Payload do vínculo a ser salvo:`, vinculoPayload);
      tx.set(vinculoRef, vinculoPayload, { merge: true });

      // 2.3 Atualiza o membro para ATIVO
      tx.set(
        membroRef,
        {
          nome: String(convite.nome || ""),
          email,
          role: membroRole,
          tipo: membroTipo,
          blocoId: conviteBlocoId,
          unidadeId: conviteUnidadeId,
          unitDocId: conviteUnitDocId,
          blocoIdNorm: blocoIdNormVal,
          unidadeIdNorm: unidadeIdNormVal,
          status: "ATIVO",
          menuPermissions: buildMenuPermissions(membroRole),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 2.4 Marca o convite como CONCLUIDO
      tx.set(
        conviteDoc.ref,
        {
          status: "CONCLUIDO",
          processedAt: FieldValue.serverTimestamp(),
          acceptedByUid: uid,
          acceptedByEmail: email,
        },
        { merge: true }
      );
    });

    // retorna ok pro front fazer login normal (email+senha)
    return NextResponse.json({
      ok: true,
      email,
      condominioId,
      uid,
      role,
    });
  } catch (err: any) {
    console.error("[API convites/finalizar-primeiro-acesso] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
