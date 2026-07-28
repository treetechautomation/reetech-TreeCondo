
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { createHash } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { createWithdrawEvent } from "@/lib/encomendas/withdrawal";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { notifyUnidade } from "@/lib/notifications/notifyUnidade";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}



async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  const email = String(decoded?.email || "").toLowerCase();
  let nome = String(decoded?.name || decoded?.email || "Operador").trim();
  let role: string | null = null;
  let status: string | null = null;

  try {
    const mref = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const msnap = await mref.get();
    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
      if (md?.status) status = String(md.status).trim();
    }
  } catch (e: any) {
    console.warn("[encomendas/retirar] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, email, nome, role, status };
}

// [UN.6F] notifyUnidade movido para lib/notifications/notifyUnidade.ts

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();
  const correlationId = extractCorrelationId(req);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body?.condominioId || "").trim();
    const encomendaId = String(body?.encomendaId || "").trim();
    
    const codigo = body?.codigo ? String(body.codigo).trim() : "";
    
    const moradorUid = body?.moradorUid ? String(body.moradorUid).trim() : "";
    const pinMorador = body?.pinMorador ? String(body.pinMorador).trim() : "";
    const recebedorNome = body?.recebedorNome ? String(body.recebedorNome).trim() : "";
    const recebedorCpf = body?.recebedorCpf ? String(body.recebedorCpf).trim() : "";
    const recebedorParentesco = body?.recebedorParentesco ? String(body.recebedorParentesco).trim() : "";

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
      if (!encomendaId) return jsonError("encomendaId é obrigatório", 400);

      const actor = await getActorInfo(db, { condominioId, uid: decoded.uid, decoded });
    
    // ACL: retirada concluída EXCLUSIVAMENTE por operador ATIVO da portaria.
    // Fonte da verdade: condominios/{condominioId}/membros/{uid}. Nunca confiar no frontend.
    const actorRoleUpper = String(actor.role || "").toUpperCase();
    const isSuperAdmin =
      (decoded as any)?.super_admin === true ||
      (decoded as any)?.superAdmin === true ||
      actorRoleUpper === "SUPER_ADMIN";
    const PAPEIS_OPERADOR = ["PORTEIRO", "ZELADOR", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"];

    if (actorRoleUpper === "MORADOR") {
      return jsonError("A retirada deve ser confirmada por um operador da portaria.", 403);
    }
    if (!isSuperAdmin) {
      if (String(actor.status || "").toUpperCase() !== "ATIVO") {
        return jsonError("Seu vínculo com o condomínio não está ativo.", 403);
      }
      if (!PAPEIS_OPERADOR.includes(actorRoleUpper)) {
        return jsonError("Apenas operadores autorizados podem registrar retiradas.", 403);
      }
    }

    const ref = db.collection("condominios").doc(condominioId).collection("encomendas").doc(encomendaId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Encomenda não encontrada.", 404);

    const data = snap.data() as any;

    // Isolamento multi-tenant: a encomenda tem de pertencer ao condomínio informado.
    if (data?.condominioId && String(data.condominioId) !== condominioId) {
      return jsonError("Encomenda não pertence a este condomínio.", 403);
    }

    if (String(data?.status || "").toUpperCase() === "RETIRADA") {
      return jsonError("Essa encomenda já foi retirada.", 409);
    }
    
    // Modo SEM Celular (PIN)
    if (moradorUid && pinMorador) {
        const pinDigits = pinMorador.replace(/\D/g, "");
        if (pinDigits.length < 4) return jsonError("PIN inválido.", 400);
        if (!recebedorNome) return jsonError("O nome de quem retira é obrigatório.", 400);

        const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(moradorUid);
        const membroSnap = await membroRef.get();
        if (!membroSnap.exists) return jsonError("Morador selecionado não encontrado.", 404);

        const membroData = membroSnap.data() as any;
        const failedAttempts = membroData.encomendaPinFailedAttempts || 0;

        if (failedAttempts >= 6) {
            return jsonError("PIN bloqueado por excesso de tentativas. O morador precisa redefinir o PIN na tela de Configurações.", 429);
        }

        const pinHash = sha256(pinDigits);
        const storedPinHash = membroData.encomendaPinHash || membroData.pinEncomendasHash;
        if (!storedPinHash) {
            return jsonError("PIN de retirada não configurado para este morador.", 400);
        }
        if (pinHash !== storedPinHash) {
            const newAttempts = failedAttempts + 1;
            await membroRef.update({ encomendaPinFailedAttempts: newAttempts });
            const attemptsLeft = 6 - newAttempts;
            const errorMsg = attemptsLeft > 0
                ? `PIN inválido. Você tem mais ${attemptsLeft} tentativas.`
                : "PIN inválido. Seu PIN foi bloqueado.";
            return jsonError(errorMsg, 403);
        }

        // Isolamento por apartamento: o morador do PIN precisa ser o destinatário
        // da encomenda. Fonte da verdade = membro (Firestore) x dados da encomenda.
        // condominioId já validado acima (mesmo path do membro e da encomenda).
        const membroUnNorm = String(
          membroData.unidadeIdNorm || normUnidade(membroData.unidadeId || membroData.apartamento) || ""
        ).trim();
        const membroBlNorm =
          membroData.blocoIdNorm != null && String(membroData.blocoIdNorm).trim() !== ""
            ? String(membroData.blocoIdNorm).trim()
            : (membroData.blocoId || membroData.bloco ? normBloco(membroData.blocoId || membroData.bloco) : "");

        const encUnNorm = String(data?.unidadeIdNorm || normUnidade(data?.unidadeId) || "").trim();
        const encBlNorm =
          data?.blocoIdNorm != null && String(data.blocoIdNorm).trim() !== ""
            ? String(data.blocoIdNorm).trim()
            : (data?.blocoId ? normBloco(data.blocoId) : "");

        if (!membroUnNorm || encUnNorm !== membroUnNorm || encBlNorm !== membroBlNorm) {
          return jsonError("O PIN informado não pertence ao destinatário desta encomenda.", 403);
        }

        // PIN correto: transação atômica com revalidação de status (anti-corrida / dupla retirada)
        await db.runTransaction(async (tx) => {
            const fresh = await tx.get(ref);
            if (!fresh.exists) {
              throw Object.assign(new Error("Encomenda não encontrada."), { status: 404 });
            }
            if (String((fresh.data() as any)?.status || "").toUpperCase() !== "AGUARDANDO") {
              throw Object.assign(new Error("Essa encomenda já foi retirada."), { status: 409 });
            }
            if (failedAttempts > 0) {
                tx.update(membroRef, { encomendaPinFailedAttempts: 0 });
            }
            tx.update(ref, {
                status: "RETIRADA",
                retiradaEm: FieldValue.serverTimestamp(),
                retiradoEm: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                registradoPorUid: decoded.uid,
                  registradoPorNome: (decoded.name || decoded.email || "Operador").toString(),

                  // quem confirmou a retirada (porteiro/operador)
                  retiradoPorUid: actor.uid,
                  retiradoPorNome: actor.nome,
                  retiradoPorEmail: actor.email,
                  retiradoPorRole: actor.role,
                retiradaRecebedorNome: recebedorNome,
                retiradaRecebedorCpfHash: recebedorCpf ? sha256(recebedorCpf.replace(/\D/g, "")) : null,
                retiradaRecebedorCpfLast4: recebedorCpf ? recebedorCpf.replace(/\D/g, "").slice(-4) : null,
                retiradaRecebedorParentesco: recebedorParentesco || "Não informado",
                withdrawMethod: "PIN",
            });
            // E.3.3: Registrar evento WITHDRAWN na subcoleção events
            const eventRef = ref.collection("events").doc();
            tx.set(eventRef, createWithdrawEvent(
              "WITHDRAWN",
              actor.uid,
              actor.role,
              actor.nome,
              { method: "PIN", encomendaId, condominioId },
            ));
        });

    // Modo COM Celular (Código/QR)
    } else if (codigo) {
        // (6) valida usando o hash armazenado; nunca confiar apenas no código recebido
        if (sha256(codigo) !== String(data?.codigoRetiradaHash || "")) {
            return jsonError("Código de retirada inválido.", 403);
        }
        // Transação atômica com revalidação de status e do hash (anti-corrida / dupla retirada)
        await db.runTransaction(async (tx) => {
            const fresh = await tx.get(ref);
            if (!fresh.exists) {
              throw Object.assign(new Error("Encomenda não encontrada."), { status: 404 });
            }
            const freshData = fresh.data() as any;
            if (String(freshData?.status || "").toUpperCase() !== "AGUARDANDO") {
              throw Object.assign(new Error("Essa encomenda já foi retirada."), { status: 409 });
            }
            if (sha256(codigo) !== String(freshData?.codigoRetiradaHash || "")) {
              throw Object.assign(new Error("Código de retirada inválido."), { status: 403 });
            }
            tx.update(ref, {
                status: "RETIRADA",
                retiradaEm: FieldValue.serverTimestamp(),
                retiradoEm: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                registradoPorUid: decoded.uid,
                  registradoPorNome: (decoded.name || decoded.email || "Operador").toString(),

                  // quem confirmou a retirada (porteiro/operador)
                  retiradoPorUid: actor.uid,
                  retiradoPorNome: actor.nome,
                  retiradoPorEmail: actor.email,
                  retiradoPorRole: actor.role,
                retiradaRecebedorNome: recebedorNome || "Próprio morador",
                withdrawMethod: "PORTEIRO",
            });
            // E.3.3: Registrar evento WITHDRAWN na subcoleção events
            const eventRef2 = ref.collection("events").doc();
            tx.set(eventRef2, createWithdrawEvent(
              "WITHDRAWN",
              actor.uid,
              actor.role,
              actor.nome,
              { method: "PORTEIRO", encomendaId, condominioId },
            ));
        });
    } else {
        return jsonError("Informe o código da encomenda (PKG-...) ou use o modo 'Sem Celular' com PIN do morador.", 400);
    }
    
    // Notificação de retirada
    try {
      await notifyUnidade(db, {
        condominioId,
        unidadeId: String(data?.unidadeId || ""),
        blocoId: data?.blocoId ?? null,
        encomendaId,
      });
    } catch (e: any) {
      console.error("[encomendas/retirar] falha ao notificar:", e?.message || e);
    }

    logEncomendaEvent({
      event: moradorUid && pinMorador ? "PACKAGE_WITHDRAW_PIN_SUCCESS" : "PACKAGE_WITHDRAW_MANUAL_SUCCESS",
      timestamp: new Date().toISOString(),
      operation: "retirar",
      result: "success",
      condominioId,
      encomendaId,
      actorUid: actor.uid,
      actorRole: actor.role,
      method: moradorUid && pinMorador ? "PIN" : "PORTEIRO",
      correlationId,
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    const status = Number(err?.status || 0) || 500;
    logEncomendaEvent({
      event: "PACKAGE_PIN_FAILED",
      timestamp: new Date().toISOString(),
      operation: "retirar",
      result: "error",
      condominioId: null,
      encomendaId: null,
      actorUid: null,
      errorCode: String(status),
      errorMessage: err?.message || "Erro inesperado",
      correlationId,
    });
    return jsonError(err?.message || "Erro inesperado", status);
  }
}
